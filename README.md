# Remote UX Evaluator MCP

这是一个基于 MCP (Model Context Protocol) 的远程 UX 体验评估服务。它能够通过 HTTP SSE (Server-Sent Events) 协议对外提供服务。

## 功能特性

*   **用户画像解析 (`resolve_persona`)**: 将自然语言描述转换为量化的用户行为参数（思考时间、耐心因子等）。
*   **体验评估 (`evaluate_experience`)**: 基于[感知时间模型]分析用户操作链路，计算物理耗时、感知耗时及疼痛评分。
*   **中文报告生成**: 自动生成包含详细数据表和改进建议的中文 Markdown 报告。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

开发模式（热更新）：
```bash
npm run dev
```

生产构建与运行：
```bash
npm run build
npm start
```

服务默认运行在 `http://localhost:3000/sse`。

## 部署

本项目是一个标准的 Node.js Express 应用，可以轻松部署到：
*   Render
*   Railway
*   Vercel
*   任何支持 Node.js 的云服务器

## MCP 配置示例

在 Trae 或 Claude Desktop 中配置：

```json
{
  "mcpServers": {
    "ux-evaluator": {
      "url": "https://your-deployment-url.com/sse",
      "transport": "sse"
    }
  }
}
```
