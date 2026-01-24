# Learn Claude Code

## 深入阅读

**技术教程 (docs/):**

| English | 中文 |
|---------|------|
| [v0: Bash is All You Need](./docs/v0-bash-is-all-you-need.md) | [v0: Bash 就是一切](./docs/v0-Bash就是一切.md) |
| [v1: Model as Agent](./docs/v1-model-as-agent.md) | [v1: 模型即代理](./docs/v1-模型即代理.md) |
| [v2: Structured Planning](./docs/v2-structured-planning.md) | [v2: 结构化规划](./docs/v2-结构化规划.md) |
| [v3: Subagent Mechanism](./docs/v3-subagent-mechanism.md) | [v3: 子代理机制](./docs/v3-子代理机制.md) |
| [v4: Skills Mechanism](./docs/v4-skills-mechanism.md) | [v4: Skills 机制](./docs/v4-Skills机制.md) |

**原创文章 (articles/) - 公众号风格:**
- [v0文章](./articles/v0文章.md) | [v1文章](./articles/v1文章.md) | [v2文章](./articles/v2文章.md) | [v3文章](./articles/v3文章.md) | [v4文章](./articles/v4文章.md)
- [上下文缓存经济学](./articles/上下文缓存经济学.md) - Agent 开发者必知的成本优化指南

## 相关项目

| 仓库 | 用途 |
|------|------|
| [Kode](https://github.com/shareAI-lab/Kode) | 全功能开源 Agent CLI（生产环境） |
| [shareAI-skills](https://github.com/shareAI-lab/shareAI-skills) | 生产就绪的 AI Agent Skills |
| [Agent Skills Spec](https://github.com/anthropics/agent-skills) | 官方规范 |

### 作为模板

Fork 并自定义为你自己的 Agent 项目：

```bash
git clone https://github.com/shareAI-lab/learn-claude-code
cd learn-claude-code
# 从任意版本级别开始
cp v1_basic_agent.py my_agent.py
```

## 设计哲学

> 模型是 80%，代码是 20%。

Kode 和 Claude Code 等现代 Agent 能工作，不是因为巧妙的工程，而是因为模型被训练成了 Agent。我们的工作就是给它工具，然后闪开。

## License

MIT

---

**模型即代理。这就是全部秘密。**

[@baicai003](https://x.com/baicai003)
