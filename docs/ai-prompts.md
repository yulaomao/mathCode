# 提示词说明与大模型接入文档

本文档用于配合创AI案例报送，说明本项目当前已经实现的提示词工程、输入输出结构、约束策略和可复现路径。当前提示词能力对应的核心代码位于 [app.py](../app.py) 中的 `build_class_summary_prompt`、`build_module_support_prompt`、`build_virtual_teacher_prompt` 与 `build_virtual_teacher_messages`。

## 1. 提示词能力总览

当前项目已落地三类提示词能力：

1. 课堂总结提示词：用于生成面向学生和教师的课堂复盘。
2. 当前环节导学提示词：用于生成某一模块的即时导学与教师建议。
3. 虚拟教师提示词：用于处理多轮追问、页面玩法说明和课后答疑。

所有大模型结果均要求结构化返回，便于前端直接渲染；如果未配置 `ARK_API_KEY` 或接口调用失败，系统自动回退为本地规则结果，确保演示不中断。

## 2. 课堂总结提示词

### 2.1 使用目标

根据一节“三位数除以两位数”互动学习的过程数据，生成可直接展示的课堂总结信息，包括学生总结、教师建议、下一步行动和风险点。

### 2.2 输入来源

输入来自前端 `buildLessonSnapshot()` 构造的课堂快照，重点字段包括：

- `currentModule`
- `completionRate`
- `completedModules`
- `duration`
- `score`、`streak`、`bestStreak`
- `analytics.warmup`
- `analytics.estimation`
- `analytics.division`

### 2.3 输出格式

必须输出 JSON，不使用 Markdown，不包裹代码块：

```json
{
  "status": "ready",
  "source": "豆包大模型",
  "studentSummary": "...",
  "teacherAdvice": "...",
  "nextStep": "...",
  "riskPoints": ["...", "..."]
}
```

### 2.4 设计约束

- 内容面向小学数学课堂，不替代学生直接解题。
- 学生总结要易懂，教师建议要可执行。
- 风险点控制在 2 到 4 条。
- 输出内容应可直接用于课堂总结页或汇报材料。

## 3. 当前环节导学提示词

### 3.1 使用目标

结合当前模块、课堂快照和受众身份，为某个学习环节生成即时导学信息。

### 3.2 输入来源

- `snapshot`：完整课堂快照
- `moduleName`：模块名，如 `warmup`、`visual`、`estimation`、`division`
- `audience`：`student` 或 `teacher`
- `imageUrl`：可选，供后续扩展图像辅助分析

### 3.3 输出格式

```json
{
  "status": "ready",
  "source": "豆包大模型",
  "headline": "...",
  "studentHint": "...",
  "nextAction": "...",
  "teacherCue": "...",
  "focusPoints": ["...", "..."]
}
```

### 3.4 设计约束

- 聚焦当前环节，不泛化成整节课复盘。
- 学生提示与教师提示要区分角色。
- `focusPoints` 用于右侧驾驶舱面板，建议 2 到 4 条。

## 4. 虚拟教师提示词

### 4.1 使用目标

围绕学生输入进行连续对话，既能解释题目步骤，也能回答“当前页面怎么玩”“这个按钮做什么”等操作性问题。

### 4.2 输入来源

- `studentInput`：学生本轮输入
- `conversationHistory`：结构化对话历史，只保留 `role` 与 `text`
- `pageContext`：页面上下文，包括 `moduleTitle`、`howToPlay`、`controls`、`currentState`

### 4.3 输出格式

```json
{
  "status": "ready",
  "source": "豆包大模型",
  "reply": "..."
}
```

### 4.4 关键策略

- 多轮连续性：使用结构化 `conversationHistory`，而不是把所有历史拼成一个长字符串。
- 历史压缩：旧对话先摘要，再保留最近轮次，控制提示词长度。
- 页面感知：只有当用户明确询问“当前页面、当前界面、这个游戏、怎么玩、按钮是什么”时，才使用 `pageContext`。
- 规则优先：对“乘8呢”“那第二步呢”这类短追问，先走本地连续追问规则，提升稳定性。
- 回退兜底：若模型不可用，则返回本地规则回答，保证问答不中断。

## 5. 提示词版本迭代记录

### V1：课堂总结单提示词

- 仅支持课堂总结生成。
- 重点是把学习数据转换成结构化复盘内容。

### V2：增加模块导学提示词

- 按模块生成学生导学与教师提示。
- 支持 `student` / `teacher` 双受众输出。

### V3：加入虚拟教师多轮对话

- 新增 `/api/ai/virtual-teacher`。
- 支持连续追问和聊天式答疑。

### V4：上下文增强与页面感知

- 引入 `conversationHistory` 结构化历史。
- 加入旧对话摘要压缩策略。
- 引入 `pageContext`，解决“当前页面怎么玩”类问题。

## 6. 可复现说明

- 当前已实现接口：`/api/ai/class-summary`、`/api/ai/module-support`、`/api/ai/virtual-teacher`
- 本地服务入口：`python app.py`
- 健康检查接口：`/api/health`
- 若未配置 `ARK_API_KEY`，系统会自动使用本地规则回退
- 提示词输入结构与输出格式可由 [app.py](../app.py)、[script.js](../script.js) 与 [docs/API说明.md](API说明.md) 交叉验证
