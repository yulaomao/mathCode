# API 说明

## 1. 接口概览

本项目后端基于 Flask 提供本地接口服务，主要用于：

- 健康检查
- 课堂总结生成
- 当前环节导学支持
- 虚拟教师多轮问答
- 静态页面托管

默认本地服务地址：`http://localhost:3000`

## 2. 通用约定

- 请求与响应编码：UTF-8
- 数据格式：JSON
- 当大模型不可用时，接口优先回退为本地规则结果
- 常见响应字段：
  - `status`：如 `ready`、`fallback`、`loading`
  - `source`：结果来源，如“豆包大模型”“本地提示”“页面上下文规则”
  - `warning`：接口异常时的补充信息

## 3. 接口详情

### 3.1 GET /api/health

#### 用途

检查后端服务与大模型配置状态。

#### 示例响应

```json
{
  "ok": true,
  "hasApiKey": true,
  "model": "doubao-seed-2-0-pro-260215",
  "mode": "ark"
}
```

#### 字段说明

- `ok`：服务是否正常
- `hasApiKey`：是否检测到 API Key
- `model`：当前使用的大模型名称
- `mode`：`ark` 表示豆包模式，`fallback` 表示本地规则模式

### 3.2 POST /api/ai/class-summary

#### 用途

根据课堂快照生成课堂总结结果。

#### 请求体核心字段

```json
{
  "sessionId": "...",
  "currentModule": "division",
  "completionRate": 75,
  "completedModules": {
    "warmup": true,
    "visual": true,
    "estimation": true,
    "division": false
  },
  "duration": "08:35",
  "analytics": {
    "warmup": {},
    "visual": {},
    "estimation": {},
    "division": {},
    "ai": {}
  }
}
```

#### 示例响应

```json
{
  "source": "豆包大模型",
  "summary": {
    "status": "ready",
    "source": "豆包大模型",
    "studentSummary": "...",
    "teacherAdvice": "...",
    "nextStep": "...",
    "riskPoints": ["...", "..."]
  }
}
```

### 3.3 POST /api/ai/module-support

#### 用途

生成当前模块的学生导学提示与教师建议。

#### 请求体

```json
{
  "snapshot": {"currentModule": "visual"},
  "moduleName": "visual",
  "audience": "student",
  "imageUrl": "https://example.com/demo.png"
}
```

#### 示例响应

```json
{
  "source": "豆包大模型",
  "support": {
    "status": "ready",
    "source": "豆包大模型",
    "headline": "...",
    "studentHint": "...",
    "nextAction": "...",
    "teacherCue": "...",
    "focusPoints": ["...", "..."]
  }
}
```

#### 说明

- `audience` 可选 `student` 或 `teacher`
- `imageUrl` 为预留扩展字段，可为空

### 3.4 POST /api/ai/virtual-teacher

#### 用途

处理虚拟教师问答，支持连续对话、页面玩法说明与本地回退。

#### 请求体

```json
{
  "studentInput": "当前界面的分配游戏怎么玩？",
  "conversationHistory": [
    {"role": "user", "text": "我在做156÷21"},
    {"role": "assistant", "text": "可以先想21乘几最接近156。"}
  ],
  "pageContext": {
    "moduleTitle": "算理探究",
    "howToPlay": "先看题目，再用加减按钮调整每人分几个。",
    "controls": "加号、减号、发射能量、换一题",
    "currentState": "当前题目是240÷40。"
  }
}
```

#### 成功响应

```json
{
  "status": "ready",
  "source": "页面上下文规则",
  "reply": "当前页面是“算理探究”。玩法是：..."
}
```

#### 失败或回退响应

```json
{
  "status": "fallback",
  "source": "本地提示",
  "reply": "...",
  "warning": "..."
}
```

#### 错误情况

- 当 `studentInput` 为空时，接口返回 `400`
- 错误响应：

```json
{
  "error": "studentInput is required"
}
```

## 4. 静态页面接口

### 4.1 GET /

返回主页面 `index.html`。

### 4.2 GET /<path:filename>

返回根目录中的静态资源文件，如 `script.js`、`style.css`。

## 5. 调用建议

- 比赛演示时优先先检查 `/api/health`
- 虚拟教师问答建议同时传入 `conversationHistory`
- 页面玩法类问题建议传入 `pageContext`
- 所有 AI 结果都建议保留 `source` 字段，用于说明结果来源