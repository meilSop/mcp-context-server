# MCP Context Server

一个基于 MCP（Model Context Protocol）协议的上下文管理服务器，为 AI 编码助手提供持久化的项目上下文存储、自动加载和 LLM 智能压缩能力。

## 功能特性

- **持久化上下文存储** - 以 Markdown 格式存储在项目目录下，跨会话保留
- **6 种分类管理** - architecture / decision / progress / knowledge / error / session
- **优先级与标签** - 支持 high/medium/low 优先级和自定义标签
- **全文搜索** - 跨所有上下文文件搜索关键词
- **LLM 智能压缩** - 文件超过阈值时自动调用 LLM 进行智能摘要
- **自动加载** - 新会话开始时自动恢复最相关的上下文
- **多编辑器兼容** - 支持 Claude Code、Qoder、Cursor、Trae、Codex、CodeBuddy 等

## 工作原理

当你在项目目录中使用本 MCP 时，它会自动在项目根目录创建 `.context/` 文件夹：

```
你的项目/
└── .context/
    ├── index.md              # 项目概览（自动生成）
    ├── architecture/         # 架构设计
    │   └── *.md
    ├── decision/             # 技术决策
    │   └── *.md
    ├── progress/             # 开发进度
    │   └── *.md
    ├── knowledge/            # 知识库
    │   └── *.md
    ├── error/                # 错误与解决方案
    │   └── *.md
    ├── session/              # 会话记录
    │   └── *.md
    └── .meta/
        ├── config.json       # 配置文件
        └── compression-log.json  # 压缩历史
```

每个上下文文件都是标准的 Markdown，包含 YAML frontmatter 元数据：

```markdown
---
title: 用户认证架构
category: architecture
priority: high
tags: [auth, jwt, security]
createdAt: 2026-05-21T10:00:00.000Z
updatedAt: 2026-05-21T10:00:00.000Z
---

## 认证方案

采用 JWT + Refresh Token 双令牌方案...
```

## MCP 工具

### context_save - 保存上下文

将重要信息保存为 Markdown 文件到项目的 `.context/` 目录。

| 参数     | 类型     | 必填 | 说明                                                             |
| -------- | -------- | ---- | ---------------------------------------------------------------- |
| title    | string   | 是   | 条目标题                                                         |
| content  | string   | 是   | Markdown 内容                                                    |
| category | enum     | 是   | architecture / decision / progress / knowledge / error / session |
| priority | enum     | 否   | high / medium / low（默认 medium）                               |
| tags     | string[] | 否   | 标签列表，便于搜索                                               |

### context_get - 获取上下文

读取指定分类或具体条目的上下文内容。

| 参数     | 类型   | 必填 | 说明                               |
| -------- | ------ | ---- | ---------------------------------- |
| category | enum   | 是   | 分类名称                           |
| name     | string | 否   | 条目名称，不传则返回该分类所有条目 |

### context_search - 搜索上下文

全文搜索，匹配标题、内容和标签，按优先级和更新时间排序。

| 参数       | 类型   | 必填 | 说明                  |
| ---------- | ------ | ---- | --------------------- |
| query      | string | 是   | 搜索关键词            |
| categories | enum[] | 否   | 限定搜索的分类        |
| limit      | number | 否   | 最大结果数（默认 20） |

### context_list - 列出上下文

列出所有或指定分类的上下文条目概览。

| 参数     | 类型 | 必填 | 说明                     |
| -------- | ---- | ---- | ------------------------ |
| category | enum | 否   | 分类名称，不传则列出所有 |

### context_delete - 删除上下文

删除指定的上下文条目。

| 参数     | 类型   | 必填 | 说明     |
| -------- | ------ | ---- | -------- |
| category | enum   | 是   | 分类名称 |
| name     | string | 是   | 条目名称 |

### context_compress - 压缩上下文

对超过阈值的文件使用 LLM 进行智能摘要压缩。需要配置 `CONTEXT_LLM_API_KEY`。

| 参数     | 类型   | 必填 | 说明                             |
| -------- | ------ | ---- | -------------------------------- |
| category | enum   | 否   | 指定分类，不传则检查所有分类     |
| name     | string | 否   | 指定条目，不传则压缩所有超标文件 |

### context_auto_load - 自动加载上下文

新会话开始时调用，自动加载项目 index 和最相关的上下文条目。

| 参数        | 类型   | 必填 | 说明                             |
| ----------- | ------ | ---- | -------------------------------- |
| query       | string | 否   | 查询关键词，用于匹配相关上下文   |
| currentFile | string | 否   | 当前编辑的文件路径，用于标签匹配 |

## MCP 资源

通过 `context://` URI 协议可直接读取上下文文件：

- `context://index` - 项目概览
- `context://{category}/{name}` - 指定上下文文件

## MCP 提示

### project_context - 加载项目上下文

自动加载最相关的项目上下文，支持传入 `query` 和 `currentFile` 参数进行精准匹配。

## 安装与构建

### 从源码构建

```bash
git clone <repo-url>
cd mcp-context-server
npm install
npm run build
```

构建产物为 `dist/index.js`（单文件，约 1.1MB，所有依赖已内嵌）。

## 集成到 AI 编辑器

在编辑器的 MCP 配置文件中添加以下配置，将路径替换为你实际的 `dist/index.js` 路径：

### Qoder

在项目根目录创建 `.mcp.json`：

```json
{
  "mcpServers": {
    "context": {
      "command": "node",
      "args": ["d:/manyao.zhu/mcp/context/dist/index.js"]
    }
  }
}
```

也可以在 Qoder 的全局设置中添加 MCP 服务器配置。配置后重启 Qoder 使其生效，在对话中输入 `/mcp` 可以检查 MCP 服务器连接状态。

### Claude Code

命令行添加：

```bash
claude mcp add context node d:/manyao.zhu/mcp/context/dist/index.js
```

或手动编辑 `.mcp.json`：

```json
{
  "mcpServers": {
    "context": {
      "command": "node",
      "args": ["d:/manyao.zhu/mcp/context/dist/index.js"]
    }
  }
}
```

### Cursor

编辑 `~/.cursor/mcp.json` 或项目下 `.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "context": {
      "command": "node",
      "args": ["d:/manyao.zhu/mcp/context/dist/index.js"]
    }
  }
}
```

### Trae

在 Trae 设置的 MCP 配置中添加：

```json
{
  "mcpServers": {
    "context": {
      "command": "node",
      "args": ["d:/manyao.zhu/mcp/context/dist/index.js"]
    }
  }
}
```

### Codex (OpenAI)

编辑 `~/.codex/mcp.json`：

```json
{
  "mcpServers": {
    "context": {
      "command": "node",
      "args": ["d:/manyao.zhu/mcp/context/dist/index.js"]
    }
  }
}
```

### CodeBuddy（腾讯云代码助手）

CodeBuddy 支持用户级和项目级两种 MCP 配置方式：

**用户级（全局）**：编辑 `~/.codebuddy/mcp.json`（macOS/Linux）或 `%USERPROFILE%\.codebuddy\mcp.json`（Windows）：

```json
{
  "mcpServers": {
    "context": {
      "command": "node",
      "args": ["d:/manyao.zhu/mcp/context/dist/index.js"]
    }
  }
}
```

**项目级（推荐）**：在项目根目录创建 `.mcp.json`：

```json
{
  "mcpServers": {
    "context": {
      "command": "node",
      "args": ["d:/manyao.zhu/mcp/context/dist/index.js"]
    }
  }
}
```

> **注意**：使用项目级 `.mcp.json` 时，需要在 CodeBuddy 设置中启用项目 MCP 服务器。可在 `settings.json` 中添加 `"enableAllProjectMcpServers": true`，或在设置面板中手动批准。配置后使用 `/mcp` 命令检查连接状态。

### 发布到 npm 后使用

发布后可直接通过 npx 运行，无需手动指定路径：

```json
{
  "mcpServers": {
    "context": {
      "command": "npx",
      "args": ["-y", "mcp-context-server"]
    }
  }
}
```

## LLM 压缩配置

在 MCP 配置的 `env` 字段中添加环境变量以启用压缩功能：

```json
{
  "mcpServers": {
    "context": {
      "command": "node",
      "args": ["d:/manyao.zhu/mcp/context/dist/index.js"],
      "env": {
        "CONTEXT_LLM_API_KEY": "sk-你的API密钥",
        "CONTEXT_LLM_MODEL": "gpt-4o-mini",
        "CONTEXT_LLM_BASE_URL": "https://api.openai.com/v1"
      }
    }
  }
}
```

支持兼容 OpenAI 格式的国产模型：

```json
{
  "env": {
    "CONTEXT_LLM_API_KEY": "你的密钥",
    "CONTEXT_LLM_MODEL": "qwen-turbo",
    "CONTEXT_LLM_BASE_URL": "https://dashscope.aliyuncs.com/compatible-mode/v1"
  }
}
```

### 环境变量说明

| 变量                         | 说明               | 默认值                      |
| ---------------------------- | ------------------ | --------------------------- |
| `CONTEXT_LLM_API_KEY`        | LLM API 密钥       | 无（不配置则压缩不可用）    |
| `CONTEXT_LLM_MODEL`          | 模型名称           | `gpt-4o-mini`               |
| `CONTEXT_LLM_BASE_URL`       | API 地址           | `https://api.openai.com/v1` |
| `CONTEXT_COMPRESS_THRESHOLD` | 压缩阈值（KB）     | `10`                        |
| `CONTEXT_MAX_AUTO_LOAD_SIZE` | 自动加载上限（KB） | `30`                        |
| `CONTEXT_DIR`                | 上下文目录名       | `.context`                  |

## 典型工作流

```
1. 开始新项目 → AI 调用 context_auto_load（无上下文，提示保存）
2. 分析项目后 → AI 调用 context_save 保存架构决策（category: architecture, priority: high）
3. 遇到 Bug 并解决 → AI 调用 context_save 保存到 error 分类
4. 做出技术选择 → AI 调用 context_save 保存到 decision 分类
5. 下次开会话 → AI 调用 context_auto_load 自动恢复上下文
6. 文件变大 → AI 调用 context_compress 智能压缩
```

## 推荐的项目规则

在项目的 AI 规则文件中添加以下指令，让 AI 自动遵循上下文管理最佳实践。

### Claude Code（CLAUDE.md）

```markdown
## 上下文管理规则

- 每次开始新会话时，先调用 context_auto_load 恢复项目上下文
- 重要架构决策保存到 architecture 分类，priority 设为 high
- 遇到并解决的 Bug，保存到 error 分类
- 每次开发结束前，保存当前进度到 progress 分类
- 使用 tags 标注涉及的技术栈（如 react、database、auth）
- 文件较大时主动调用 context_compress 压缩
```

### Cursor（.cursor/rules/context.mdc）

```markdown
---
description: 上下文管理规则
globs:
alwaysApply: true
---

- 每次开始新会话时，先调用 context_auto_load 恢复项目上下文
- 重要架构决策保存到 architecture 分类，priority 设为 high
- 遇到并解决的 Bug，保存到 error 分类
- 使用 tags 标注涉及的技术栈
```

### Qoder（.qoder/rules/context.md）

在 Qoder 中，规则文件放在 `.qoder/rules/` 目录下，AI 会自动读取：

```markdown
---
description: 上下文管理规则
globs:
alwaysApply: true
---

- 每次开始新会话时，先调用 context_auto_load 恢复项目上下文
- 重要架构决策保存到 architecture 分类，priority 设为 high
- 遇到并解决的 Bug，保存到 error 分类
- 使用 tags 标注涉及的技术栈
```

### CodeBuddy（CODEBUDDY.md）

CodeBuddy 使用 `CODEBUDDY.md` 作为规则文件，支持用户级和项目级：

- **用户级**：`~/.codebuddy/CODEBUDDY.md`（适用于所有项目）
- **项目级**：项目根目录下的 `CODEBUDDY.md`（优先级更高）

```markdown
## 上下文管理规则

- 每次开始新会话时，先调用 context_auto_load 恢复项目上下文
- 重要架构决策保存到 architecture 分类，priority 设为 high
- 遇到并解决的 Bug，保存到 error 分类
- 每次开发结束前，保存当前进度到 progress 分类
- 使用 tags 标注涉及的技术栈（如 react、database、auth）
- 文件较大时主动调用 context_compress 压缩
```

## 技术栈

- TypeScript + Node.js 18+
- @modelcontextprotocol/sdk v1.x
- zod（Schema 验证）
- tsup（构建打包，单文件输出）

## License

MIT
