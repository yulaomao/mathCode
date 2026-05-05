import json
import os
import re
from pathlib import Path
from urllib import error, request

from flask import Flask, jsonify, request as flask_request, send_from_directory


ROOT_DIR = Path(__file__).resolve().parent
MAX_VIRTUAL_TEACHER_HISTORY = 32
KEEP_RECENT_VIRTUAL_TEACHER_MESSAGES = 10
SUMMARY_VIRTUAL_TEACHER_MESSAGES = 12


def load_env_file(file_path: Path) -> dict:
    if not file_path.exists():
        return {}

    loaded = {}
    for raw_line in file_path.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        loaded[key.strip()] = value.strip()
    return loaded


ENV = load_env_file(ROOT_DIR / '.env')
PORT = int(os.environ.get('PORT') or ENV.get('PORT') or 3000)
ARK_API_KEY = os.environ.get('ARK_API_KEY') or ENV.get('ARK_API_KEY') or ''
ARK_MODEL = os.environ.get('ARK_MODEL') or ENV.get('ARK_MODEL') or 'doubao-seed-2-0-pro-260215'

app = Flask(__name__, static_folder=None)


def safe_json_parse(text, fallback=None):
    try:
        return json.loads(text)
    except (TypeError, json.JSONDecodeError):
        return {} if fallback is None else fallback


def strip_code_fence(text: str) -> str:
    cleaned = str(text or '').strip()
    if cleaned.startswith('```json'):
        cleaned = cleaned[7:].strip()
    elif cleaned.startswith('```'):
        cleaned = cleaned[3:].strip()
    if cleaned.endswith('```'):
        cleaned = cleaned[:-3].strip()
    return cleaned


def get_completion_rate(snapshot: dict) -> int:
    completed_modules = snapshot.get('completedModules') or {}
    module_names = list(completed_modules.keys())
    if not module_names:
        return 0
    completed_count = sum(1 for value in completed_modules.values() if value)
    return round((completed_count / len(module_names)) * 100)


def format_accuracy(correct: int, attempts: int) -> str:
    if not attempts:
        return '暂无'
    return f"{round((correct / attempts) * 100)}%"


def get_recommended_module(snapshot: dict) -> str:
    completed_modules = snapshot.get('completedModules') or {}
    for module_name in ['warmup', 'visual', 'estimation', 'division']:
        if not completed_modules.get(module_name):
            return module_name
    return 'summary'


def get_module_title(module_name: str) -> str:
    titles = {
        'warmup': '口算热身',
        'visual': '算理探究',
        'estimation': '估算试商',
        'division': '竖式巩固',
        'summary': '课堂总结',
    }
    return titles.get(module_name, '课堂总结')


def get_risk_points(snapshot: dict) -> list[str]:
    analytics = snapshot.get('analytics') or {}
    warmup = analytics.get('warmup') or {}
    estimation = analytics.get('estimation') or {}
    division = analytics.get('division') or {}
    points = []

    if warmup.get('attempts', 0) > 0 and warmup.get('correct', 0) < warmup.get('wrong', 0):
        points.append('口算热身中对商的快速判断还不够稳定，可增加口头估商热身。')
    if estimation.get('tooHigh', 0) > estimation.get('tooLow', 0) and estimation.get('attempts', 0) > 0:
        points.append('估算试商中商偏大的情况更多，建议强化“乘回去比较”的判断。')
    if division.get('prompts', 0) >= 2:
        points.append('竖式训练对步骤提示依赖较强，需要继续强化“试商、乘、减、落”口令。')
    if get_completion_rate(snapshot) < 50:
        points.append('当前课堂仍处于推进阶段，建议先完成更多核心模块再做整合总结。')

    if not points:
        points.append('整体课堂节奏较平稳，可补充一题变式练习检验迁移能力。')

    return points[:4]


def build_fallback_summary(snapshot: dict) -> dict:
    analytics = snapshot.get('analytics') or {}
    completed_modules = snapshot.get('completedModules') or {}
    completed_count = sum(1 for value in completed_modules.values() if value)
    next_module = get_recommended_module(snapshot)
    next_module_title = get_module_title(next_module)
    warmup_accuracy = format_accuracy((analytics.get('warmup') or {}).get('correct', 0), (analytics.get('warmup') or {}).get('attempts', 0))
    estimation_accuracy = format_accuracy((analytics.get('estimation') or {}).get('correct', 0), (analytics.get('estimation') or {}).get('attempts', 0))

    return {
        'status': 'fallback',
        'source': '本地规则建议',
        'studentSummary': f'本节课已完成 {completed_count} / 4 个核心环节，口算正确率 {warmup_accuracy}，估算试商表现 {estimation_accuracy}。',
        'teacherAdvice': '建议在课堂总结中用一题完整竖式引导学生口述“估一估、试一试、算一算、验一验”。' if completed_count >= 3 else '建议优先完成未完成模块，并在错误较多的环节安排短暂停顿讲评。',
        'nextStep': f'下一步推荐进入“{next_module_title}”，围绕当前薄弱点继续练习。',
        'riskPoints': get_risk_points(snapshot),
    }


def create_prompt_payload(snapshot: dict) -> dict:
    analytics = snapshot.get('analytics') or {}
    warmup = analytics.get('warmup') or {}
    estimation = analytics.get('estimation') or {}
    division = analytics.get('division') or {}
    return {
        'currentModule': snapshot.get('currentModule', 'warmup'),
        'completionRate': get_completion_rate(snapshot),
        'duration': snapshot.get('duration', '00:00'),
        'score': snapshot.get('score', 0),
        'bestStreak': snapshot.get('bestStreak', 0),
        'completedModules': snapshot.get('completedModules') or {},
        'warmup': {
            'rounds': warmup.get('rounds', 0),
            'attempts': warmup.get('attempts', 0),
            'correct': warmup.get('correct', 0),
            'wrong': warmup.get('wrong', 0),
            'accuracy': format_accuracy(warmup.get('correct', 0), warmup.get('attempts', 0)),
            'lastDifficulty': warmup.get('lastDifficulty', '未开始'),
        },
        'estimation': {
            'rounds': estimation.get('rounds', 0),
            'attempts': estimation.get('attempts', 0),
            'correct': estimation.get('correct', 0),
            'tooHigh': estimation.get('tooHigh', 0),
            'tooLow': estimation.get('tooLow', 0),
            'accuracy': format_accuracy(estimation.get('correct', 0), estimation.get('attempts', 0)),
        },
        'division': {
            'rounds': division.get('rounds', 0),
            'prompts': division.get('prompts', 0),
            'entries': division.get('entries', 0),
            'correct': division.get('correct', 0),
            'wrong': division.get('wrong', 0),
        },
    }


def build_class_summary_prompt(snapshot: dict) -> str:
    payload = create_prompt_payload(snapshot)
    lines = [
        '你是一名小学数学课堂 AI 助教，需要根据一节“三位数除以两位数”的课堂互动数据输出结构化课堂复盘。',
        '请严格遵守以下要求：',
        '1. 只输出 JSON 对象，不要输出 Markdown、解释或代码块。',
        '2. JSON 必须包含字段：status、source、studentSummary、teacherAdvice、nextStep、riskPoints。',
        '3. status 固定写 ready。',
        '4. source 固定写 豆包大模型。',
        '5. studentSummary 面向学生，语言积极、简洁，不直接给答案。',
        '6. teacherAdvice 面向教师，给出 1 到 2 句可以立即执行的课堂建议。',
        '7. nextStep 只写一句下一步课堂推进建议。',
        '8. riskPoints 输出 2 到 4 条数组，聚焦课堂风险与学习薄弱点。',
        '9. 内容必须符合小学数学课堂语言，强调理解过程，不鼓励代做。',
        '',
        f'课堂数据：{json.dumps(payload, ensure_ascii=False)}',
    ]
    return '\n'.join(lines)


def build_module_support_prompt(snapshot: dict, module_name: str, audience: str) -> str:
    payload = create_prompt_payload(snapshot)
    module_title = get_module_title(module_name)
    audience_label = '教师' if audience == 'teacher' else '学生'
    lines = [
        '你是一名小学数学课堂 AI 助教，需要根据当前模块与课堂互动数据，为当前环节生成即时导学建议。',
        '请严格遵守以下要求：',
        '1. 只输出 JSON 对象，不要输出 Markdown、解释或代码块。',
        '2. JSON 必须包含字段：status、source、headline、studentHint、nextAction、teacherCue、focusPoints。',
        '3. status 固定写 ready。',
        '4. source 固定写 豆包大模型。',
        '5. headline 是当前模块的一句话标题，适合课堂上直接展示。',
        '6. studentHint 面向学生，给出当前环节的理解提示，不直接给答案。',
        '7. nextAction 面向学生，告诉他下一步应该做什么。',
        '8. teacherCue 面向教师，给出 1 句可以立刻用于教学追问或讲评的话。',
        '9. focusPoints 输出 2 到 4 条数组，聚焦当前模块的关键观察点。',
        '10. 语言必须符合小学数学课堂，突出理解过程与策略表达。',
        '',
        f'当前模块：{module_title}',
        f'当前受众：{audience_label}',
        f'课堂数据：{json.dumps(payload, ensure_ascii=False)}',
    ]
    return '\n'.join(lines)


def normalize_conversation_history(raw_history) -> list[dict]:
    history = []
    for item in raw_history or []:
        if not isinstance(item, dict):
            continue
        role = str(item.get('role') or '').strip().lower()
        text = str(item.get('text') or '').strip()
        if role not in {'user', 'assistant'} or not text:
            continue
        history.append({'role': role, 'text': text})
    return history[-MAX_VIRTUAL_TEACHER_HISTORY:]


def compact_conversation_text(text: str, limit: int = 90) -> str:
    normalized = re.sub(r'\s+', ' ', str(text or '').strip())
    if len(normalized) <= limit:
        return normalized
    return f'{normalized[: limit - 1]}…'


def reduce_conversation_history(conversation_history: list[dict] | None = None) -> tuple[str, list[dict]]:
    history = normalize_conversation_history(conversation_history)
    if len(history) <= KEEP_RECENT_VIRTUAL_TEACHER_MESSAGES:
        return '', history

    older_history = history[:-KEEP_RECENT_VIRTUAL_TEACHER_MESSAGES]
    recent_history = history[-KEEP_RECENT_VIRTUAL_TEACHER_MESSAGES:]
    summary_source = older_history[-SUMMARY_VIRTUAL_TEACHER_MESSAGES:]
    lines = []

    omitted_count = len(older_history) - len(summary_source)
    if omitted_count > 0:
        lines.append(f'更早还有 {omitted_count} 条历史，这里保留离当前最近的关键片段：')
    else:
        lines.append('更早对话摘要：')

    for item in summary_source:
        speaker = '学生' if item.get('role') == 'user' else '虚拟教师'
        lines.append(f'- {speaker}：{compact_conversation_text(item.get("text", ""))}')

    return '\n'.join(lines), recent_history


def normalize_page_context(raw_context) -> dict:
    if not isinstance(raw_context, dict):
        return {}

    normalized = {}
    for key in ('moduleName', 'moduleTitle', 'moduleDescription', 'goal', 'currentState', 'howToPlay', 'controls'):
        value = str(raw_context.get(key) or '').strip()
        if value:
            normalized[key] = value
    return normalized


def is_page_context_question(student_input: str) -> bool:
    text = str(student_input or '').strip()
    return bool(re.search(r'当前页面|当前界面|这个页面|这个界面|这页|这一页|这个游戏|当前游戏|这个模块|当前模块|怎么玩|怎么操作|如何玩|游戏规则|按钮|发射能量|滑块|加号|减号|换一题|确认|退格|分配游戏|这一关|这个关卡', text))


def build_page_context_summary(page_context: dict) -> str:
    if not page_context:
        return '无'

    lines = []
    label_map = {
        'moduleTitle': '页面名称',
        'moduleDescription': '页面说明',
        'goal': '页面目标',
        'currentState': '当前状态',
        'howToPlay': '玩法说明',
        'controls': '主要操作',
    }
    for key in ('moduleTitle', 'moduleDescription', 'goal', 'currentState', 'howToPlay', 'controls'):
        value = page_context.get(key)
        if value:
            lines.append(f"{label_map[key]}：{value}")
    return '\n'.join(lines) if lines else '无'


def build_page_context_reply(student_input: str, page_context: dict) -> str | None:
    if not page_context or not is_page_context_question(student_input):
        return None

    title = page_context.get('moduleTitle') or '当前页面'
    description = page_context.get('moduleDescription') or ''
    how_to_play = page_context.get('howToPlay') or ''
    controls = page_context.get('controls') or ''
    current_state = page_context.get('currentState') or ''
    text = str(student_input or '')

    if re.search(r'怎么玩|怎么操作|如何玩|游戏规则|分配游戏', text):
        return f'当前页面是“{title}”。玩法是：{how_to_play}{f" 操作上：{controls}" if controls else ""}{f" 现在这页的状态是：{current_state}" if current_state else ""}'

    if re.search(r'按钮|发射能量|滑块|加号|减号|换一题|确认|退格', text):
        return f'当前页面是“{title}”。主要操作有：{controls or how_to_play}{f" 现在界面显示的是：{current_state}" if current_state else ""}'

    return f'当前页面是“{title}”。{description}{f" 这一页的玩法是：{how_to_play}" if how_to_play else ""}{f" 目前画面内容是：{current_state}" if current_state else ""}'


def format_conversation_history(conversation_history: list[dict]) -> str:
    if not conversation_history:
        return '无'

    lines = []
    for item in conversation_history:
        speaker = '学生' if item.get('role') == 'user' else '虚拟教师'
        lines.append(f"{speaker}：{item.get('text', '')}")
    return '\n'.join(lines)


def extract_recent_division_focus(conversation_history: list[dict] | None = None) -> dict | None:
    texts = []
    for item in reversed(conversation_history or []):
        text = str(item.get('text') or '').strip()
        if text:
            texts.append(text)

    for text in texts:
        division_match = re.search(r'(\d+)\s*[÷/]\s*(\d+)', text)
        if division_match:
            return {
                'dividend': int(division_match.group(1)),
                'divisor': int(division_match.group(2)),
            }

        trial_match = re.search(r'(\d+)\s*乘(?:多少|几).{0,8}?(\d+)', text)
        if trial_match:
            return {
                'dividend': int(trial_match.group(2)),
                'divisor': int(trial_match.group(1)),
            }

    return None


def build_trial_multiplication_reply(student_input: str, conversation_history: list[dict] | None = None) -> str | None:
    focus = extract_recent_division_focus(conversation_history=conversation_history)
    multiplier_match = re.search(r'乘\s*(\d+)', student_input)
    if not multiplier_match:
        multiplier_match = re.search(r'为什么不能是\s*(\d+)', student_input)
    if not multiplier_match:
        multiplier_match = re.fullmatch(r'(?:那|试|商是)?\s*(\d+)\s*(?:呢|吗)?', student_input.strip())
    if not focus or not multiplier_match:
        return None

    factor = int(multiplier_match.group(1))
    divisor = focus['divisor']
    dividend = focus['dividend']
    product = divisor * factor

    if product > dividend:
        return f'如果是在继续试商，那就是看 {divisor} 乘 {factor}。{divisor}×{factor}={product}，已经超过 {dividend} 了，所以 {factor} 偏大，可以再试小一点。'
    if product == dividend:
        return f'如果是在继续试商，那就是看 {divisor} 乘 {factor}。{divisor}×{factor}={product}，正好等于 {dividend}，说明这一步就试对了。'

    remainder = dividend - product
    if remainder < divisor:
        return f'如果是在继续试商，那就是看 {divisor} 乘 {factor}。{divisor}×{factor}={product}，还没有超过 {dividend}，余下 {remainder}，而且余数比除数小，这个商就可以继续往下判断。'

    return f'如果是在继续试商，那就是看 {divisor} 乘 {factor}。{divisor}×{factor}={product}，还没有超过 {dividend}，但还可以继续试更大的数。'


def build_virtual_teacher_prompt(history_summary: str = '', conversation_history: list[dict] | None = None, page_context: dict | None = None) -> str:
    focus = extract_recent_division_focus(conversation_history=conversation_history)
    lines = [
        '# Identity',
        '你是一名虚拟教师，需要基于最近几轮对话继续回答。',
        '',
        '# Instructions',
        '- 只输出 JSON 对象，不要输出 Markdown、解释或代码块。',
        '- JSON 必须包含字段：status、source、reply。',
        '- status 固定写 ready。',
        '- source 固定写 豆包大模型。',
        '- reply 只写一段简洁中文，先承接学生当前这句话，再继续上一轮尚未结束的话题。',
        '- 如果学生使用代词、省略、短句追问，例如“为什么”“那这一步呢”“继续说”“乘8呢”，默认先回看最近对话并解析它指向的上一轮语义。',
        '- 回答时优先参考结构化历史消息，不要把每一轮都当成独立新问题。',
        '- 如果最近对话里已经出现具体算式或试商线索，后续短句默认沿用那个算式来补全主语。',
        '- 如果学生明确在问“当前页面/当前界面/这个游戏/这个按钮/怎么玩”，再使用页面上下文来回答；否则优先按对话连续性作答。',
        '- 只根据聊天上下文连续作答，不要转成课堂复盘、教师建议、学情分析或其他扩展内容。',
        '- 语言适合课堂交流，优先直接、清楚、连贯。',
        '',
        '# Example',
        '- 学生：156÷21怎么想',
        '- 虚拟教师：先试商，看21乘几最接近156。',
        '- 学生：乘8呢',
        '- 正确理解：这是对上一句“21乘几”的追问，应继续解释 21×8 与 156 的关系。',
    ]

    if history_summary:
        lines.extend(['', '# Earlier Summary', history_summary])

    if page_context:
        lines.extend(['', '# Current Page Context', build_page_context_summary(page_context)])

    if focus:
        lines.extend(
            [
                '',
                '# Resolved Math Focus',
                f"最近对话补全出的算式焦点：{focus['dividend']} ÷ {focus['divisor']}",
                f"如果学生追问“乘某个数呢”，默认是在判断 {focus['divisor']} × 这个数 是否超过 {focus['dividend']}。",
            ]
        )

    return '\n'.join(lines)


def build_text_input_message(role: str, text: str) -> dict:
    return {
        'role': role,
        'content': [
            {
                'type': 'input_text',
                'text': text,
            }
        ],
    }


def build_virtual_teacher_messages(student_input: str, conversation_history: list[dict] | None = None, page_context: dict | None = None) -> list[dict]:
    history_summary, recent_history = reduce_conversation_history(conversation_history)
    messages = [build_text_input_message('user', build_virtual_teacher_prompt(history_summary=history_summary, conversation_history=recent_history, page_context=page_context))]

    for item in recent_history:
        messages.append(build_text_input_message(item['role'], item['text']))

    messages.append(build_text_input_message('user', student_input))
    return messages


def extract_response_text(result: dict) -> str:
    output_text = result.get('output_text')
    if isinstance(output_text, str) and output_text.strip():
        return output_text.strip()

    parts = []
    for item in result.get('output', []) or []:
        for content in item.get('content', []) or []:
            if isinstance(content.get('text'), str):
                parts.append(content['text'])
            if isinstance(content.get('output_text'), str):
                parts.append(content['output_text'])
    return '\n'.join(parts).strip()


def build_ark_content(prompt_text: str, image_url: str | None = None) -> list[dict]:
    content = []
    if image_url:
        content.append(
            {
                'type': 'input_image',
                'image_url': image_url,
            }
        )
    content.append(
        {
            'type': 'input_text',
            'text': prompt_text,
        }
    )
    return content


def call_ark_messages(input_messages: list[dict]) -> dict:
    request_body = json.dumps(
        {
            'model': ARK_MODEL,
            'input': input_messages,
        },
        ensure_ascii=False,
    ).encode('utf-8')

    http_request = request.Request(
        'https://ark.cn-beijing.volces.com/api/v3/responses',
        data=request_body,
        headers={
            'Authorization': f'Bearer {ARK_API_KEY}',
            'Content-Type': 'application/json',
        },
        method='POST',
    )

    try:
        with request.urlopen(http_request, timeout=30) as response:
            raw_data = response.read().decode('utf-8')
    except error.HTTPError as exc:
        error_body = exc.read().decode('utf-8', errors='ignore')
        parsed = safe_json_parse(error_body, {})
        raise RuntimeError(parsed.get('error', {}).get('message') or f'豆包接口请求失败：{exc.code}') from exc
    except error.URLError as exc:
        raise RuntimeError(f'豆包接口请求失败：{exc.reason}') from exc

    parsed = safe_json_parse(raw_data, None)
    if parsed is None:
        raise RuntimeError('豆包接口返回了无法解析的 JSON。')
    return parsed


def call_ark_response(prompt_text: str, image_url: str | None = None) -> dict:
    return call_ark_messages(
        [
            {
                'role': 'user',
                'content': build_ark_content(prompt_text, image_url),
            }
        ]
    )


def generate_class_summary(snapshot: dict) -> dict:
    if not ARK_API_KEY:
        return build_fallback_summary(snapshot)

    prompt_text = build_class_summary_prompt(snapshot)
    model_result = call_ark_response(prompt_text)
    model_text = extract_response_text(model_result)
    parsed_summary = safe_json_parse(strip_code_fence(model_text), None)

    if parsed_summary is None:
        raise RuntimeError('豆包返回内容不是可解析的 JSON。')

    risk_points = parsed_summary.get('riskPoints')
    if not isinstance(risk_points, list) or not risk_points:
        risk_points = get_risk_points(snapshot)

    return {
        'status': parsed_summary.get('status') or 'ready',
        'source': parsed_summary.get('source') or '豆包大模型',
        'studentSummary': parsed_summary.get('studentSummary') or '本节课已生成课堂总结。',
        'teacherAdvice': parsed_summary.get('teacherAdvice') or '建议结合课堂数据进行讲评。',
        'nextStep': parsed_summary.get('nextStep') or f'继续推进“{get_module_title(get_recommended_module(snapshot))}”。',
        'riskPoints': risk_points[:4],
    }


def build_fallback_module_support(snapshot: dict, module_name: str, audience: str) -> dict:
    analytics = snapshot.get('analytics') or {}
    warmup_accuracy = format_accuracy((analytics.get('warmup') or {}).get('correct', 0), (analytics.get('warmup') or {}).get('attempts', 0))
    estimation_accuracy = format_accuracy((analytics.get('estimation') or {}).get('correct', 0), (analytics.get('estimation') or {}).get('attempts', 0))
    division_entries = (analytics.get('division') or {}).get('entries', 0)
    division_correct = (analytics.get('division') or {}).get('correct', 0)
    division_accuracy = format_accuracy(division_correct, division_entries)
    templates = {
        'warmup': {
            'headline': '先判断除数和被除数的大致关系',
            'studentHint': f'当前口算正确率 {warmup_accuracy}。先看几个十除以几个十，再判断商可能是几。',
            'nextAction': '点击气泡前，先口头说出商的大致范围。',
            'teacherCue': '可以追问学生：为什么这个商不是更大或更小？',
            'focusPoints': ['关注学生能否先说出商的范围。', '引导学生比较被除数和除数的大小关系。'],
        },
        'visual': {
            'headline': '把除法变成“平均分”的画面',
            'studentHint': '先想每个机器人要分到几个十，再按住发射按钮完成平均分。',
            'nextAction': '调整“每人分几个”，观察仓库能否刚好分完。',
            'teacherCue': '分配完成后，让学生解释“每人分到几个十，所以商为什么是几”。',
            'focusPoints': ['引导学生说出“每人分到几个十”。', '把动画结果迁移回算式表达。'],
        },
        'estimation': {
            'headline': '先估商，再乘回去比较',
            'studentHint': f'当前估算试商表现 {estimation_accuracy}。先选一个接近的商，再看乘积有没有超过被除数。',
            'nextAction': '动力过载说明商偏大，余数还大说明商偏小。',
            'teacherCue': '先让学生预测商，再解释为什么偏大或偏小。',
            'focusPoints': ['关注学生是否会“乘回去比较”。', '强化“余数一定比除数小”的判断。'],
        },
        'division': {
            'headline': '竖式要按“试商、乘、减、落”一步一步来',
            'studentHint': f'当前竖式表现 {division_accuracy}。先看当前被除数里有几个除数。',
            'nextAction': '写商后马上想“这个商乘除数是多少”，再继续减法和落位。',
            'teacherCue': '要求学生边写边说步骤名称，帮助形成稳定策略链条。',
            'focusPoints': ['先判断商，再乘回去。', '减法完成后，别忘记把下一位落下来。'],
        },
        'summary': {
            'headline': '把整节课的方法链条说完整',
            'studentHint': '试着用“估一估、试一试、算一算、验一验”复述整节课的方法。',
            'nextAction': '结合课堂总结页，决定是否需要补做迁移练习。',
            'teacherCue': '优先围绕“试商”和“步骤衔接”组织讲评。',
            'focusPoints': ['结合完成率与错误点组织讲评。', '优先处理“商偏大”和“步骤断裂”两类问题。'],
        },
    }

    template = templates.get(module_name, templates['warmup'])
    source = '本地规则教师建议' if audience == 'teacher' else '本地规则导学'
    return {
        'status': 'fallback',
        'source': source,
        **template,
    }


def generate_module_support(snapshot: dict, module_name: str, audience: str, image_url: str | None = None) -> dict:
    if not ARK_API_KEY:
        return build_fallback_module_support(snapshot, module_name, audience)

    prompt_text = build_module_support_prompt(snapshot, module_name, audience)
    model_result = call_ark_response(prompt_text, image_url=image_url)
    model_text = extract_response_text(model_result)
    parsed_support = safe_json_parse(strip_code_fence(model_text), None)

    if parsed_support is None:
        raise RuntimeError('豆包返回的模块建议不是可解析的 JSON。')

    focus_points = parsed_support.get('focusPoints')
    if not isinstance(focus_points, list) or not focus_points:
        focus_points = build_fallback_module_support(snapshot, module_name, audience)['focusPoints']

    return {
        'status': parsed_support.get('status') or 'ready',
        'source': parsed_support.get('source') or '豆包大模型',
        'headline': parsed_support.get('headline') or f'{get_module_title(module_name)} AI 建议',
        'studentHint': parsed_support.get('studentHint') or '请结合当前环节继续完成课堂任务。',
        'nextAction': parsed_support.get('nextAction') or '优先完成当前互动任务。',
        'teacherCue': parsed_support.get('teacherCue') or '教师可结合当前环节组织补充追问。',
        'focusPoints': focus_points[:4],
    }


def build_fallback_virtual_teacher_reply(snapshot: dict, student_input: str, conversation_history: list[dict] | None = None, page_context: dict | None = None) -> dict:
    has_history = bool(conversation_history)
    prefix = '我接着刚才的话继续说。' if has_history else ''
    page_reply = build_page_context_reply(student_input, page_context or {})
    if page_reply:
        return {
            'status': 'fallback',
            'source': '本地提示',
            'reply': page_reply,
        }

    trial_reply = build_trial_multiplication_reply(student_input, conversation_history=conversation_history)
    if trial_reply:
        return {
            'status': 'fallback',
            'source': '本地提示',
            'reply': trial_reply,
        }
    last_assistant_reply = ''
    for item in reversed(conversation_history or []):
        if item.get('role') == 'assistant' and item.get('text'):
            last_assistant_reply = str(item['text']).strip()
            break

    if last_assistant_reply:
        reply = f'{prefix}你刚才问“{student_input}”。如果这是在追问上一句里的某一步，你可以直接说“刚才哪一步”或“哪个数字”，我会顺着上文继续解释。'
    else:
        reply = f'你刚才问“{student_input}”。如果你愿意，可以继续补充背景或直接追问上一句里的某一步，我会按聊天上下文继续回答。'

    return {
        'status': 'fallback',
        'source': '本地提示',
        'reply': reply,
    }


def generate_virtual_teacher_reply(snapshot: dict, student_input: str, conversation_history: list[dict] | None = None, page_context: dict | None = None) -> dict:
    page_reply = build_page_context_reply(student_input, page_context or {})
    if page_reply:
        return {
            'status': 'ready',
            'source': '页面上下文规则',
            'reply': page_reply,
        }

    trial_reply = build_trial_multiplication_reply(student_input, conversation_history=conversation_history)
    if trial_reply:
        return {
            'status': 'ready',
            'source': '连续追问规则',
            'reply': trial_reply,
        }

    if not ARK_API_KEY:
        return build_fallback_virtual_teacher_reply(snapshot, student_input, conversation_history=conversation_history, page_context=page_context)

    model_result = call_ark_messages(build_virtual_teacher_messages(student_input, conversation_history=conversation_history, page_context=page_context))
    model_text = extract_response_text(model_result)
    parsed_reply = safe_json_parse(strip_code_fence(model_text), None)

    if parsed_reply is None:
        raise RuntimeError('豆包返回内容不是可解析的 JSON。')

    return {
        'status': parsed_reply.get('status') or 'ready',
        'source': parsed_reply.get('source') or '豆包大模型',
        'reply': parsed_reply.get('reply') or build_fallback_virtual_teacher_reply(snapshot, student_input, conversation_history=conversation_history, page_context=page_context)['reply'],
    }


@app.get('/api/health')
def health_check():
    return jsonify(
        {
            'ok': True,
            'hasApiKey': bool(ARK_API_KEY),
            'model': ARK_MODEL,
            'mode': 'ark' if ARK_API_KEY else 'fallback',
        }
    )


@app.post('/api/ai/class-summary')
def class_summary():
    snapshot = flask_request.get_json(silent=True) or {}
    try:
        summary = generate_class_summary(snapshot)
        return jsonify({'source': summary['source'], 'summary': summary})
    except Exception as exc:  # noqa: BLE001
        fallback = build_fallback_summary(snapshot)
        return jsonify({'source': '本地规则建议', 'summary': fallback, 'warning': str(exc)})


@app.post('/api/ai/module-support')
def module_support():
    payload = flask_request.get_json(silent=True) or {}
    snapshot = payload.get('snapshot') or payload
    module_name = payload.get('moduleName') or snapshot.get('currentModule') or 'warmup'
    audience = payload.get('audience') or 'student'
    image_url = payload.get('imageUrl')
    try:
        support = generate_module_support(snapshot, module_name, audience, image_url=image_url)
        return jsonify({'source': support['source'], 'support': support})
    except Exception as exc:  # noqa: BLE001
        fallback = build_fallback_module_support(snapshot, module_name, audience)
        return jsonify({'source': fallback['source'], 'support': fallback, 'warning': str(exc)})


@app.post('/api/ai/virtual-teacher')
def virtual_teacher():
    payload = flask_request.get_json(silent=True) or {}
    student_input = str(payload.get('studentInput') or '').strip()
    conversation_history = normalize_conversation_history(payload.get('conversationHistory'))
    page_context = normalize_page_context(payload.get('pageContext'))

    if not student_input:
        return jsonify({'error': 'studentInput is required'}), 400

    snapshot = payload.get('snapshot') or {}

    try:
        reply = generate_virtual_teacher_reply(snapshot, student_input, conversation_history=conversation_history, page_context=page_context)
        return jsonify(reply)
    except Exception as exc:  # noqa: BLE001
        fallback = build_fallback_virtual_teacher_reply(snapshot, student_input, conversation_history=conversation_history, page_context=page_context)
        return jsonify({**fallback, 'warning': str(exc)})


@app.get('/')
def index():
    return send_from_directory(ROOT_DIR, 'index.html')


@app.get('/<path:filename>')
def static_files(filename: str):
    return send_from_directory(ROOT_DIR, filename)


if __name__ == '__main__':
    print(f'课堂智能系统已启动：http://localhost:{PORT}')
    if not ARK_API_KEY:
        print('未检测到 ARK_API_KEY，AI 课堂分析将回退为本地规则建议。')
    app.run(host='0.0.0.0', port=PORT, debug=False)