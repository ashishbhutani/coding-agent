# 🤖 Coding Agent

> An AI-powered coding assistant built from scratch — no LangChain, no magic, just TypeScript and raw LLM calls.

[![Tests](https://img.shields.io/badge/tests-104%20passing-brightgreen)](./src)
[![Model](https://img.shields.io/badge/model-Gemini%202.5%20Pro-blue)](https://deepmind.google/gemini)
[![License](https://img.shields.io/badge/license-MIT-gray)](./LICENSE)

---

## Why This Exists

This project was built as an exercise in understanding AI agents from first principles — not by stitching together LangChain abstractions, but by building every piece by hand: the agent loop, tool execution, history compression, cost tracking, safety guardrails, and session persistence.

The goal is a coding assistant you can actually trust and reason about, because you wrote every line of it.

**Operating model:** Implementation is executed by AI (code, tests, commits). Architecture, feature decisions, and product direction come from the human. Every feature in this repo was designed in conversation and then built autonomously by the agent.

---

## What It Does

A terminal-based coding assistant that can read, write, and modify code across your project, run commands, search your codebase, and manage git — all driven by a conversational interface.

```
🧑 You: scaffold a Spring AI project with a REST controller

🤖 Agent:
Here's my plan:
1) Download Spring Initializr starter
2) Set up project structure and pom.xml
3) Add Spring milestones repository
4) Run mvn clean install (5 min timeout)
5) Create controller with AI endpoint
6) Verify build passes

Does this look right?
```

---

## Current Capabilities

### 🛠️ Tools
| Tool | What it does |
|------|-------------|
| `read_file` | Read files with line numbers and range support |
| `write_file` | Create or overwrite files |
| `edit_file` | Search-and-replace or line-range edits |
| `insert_lines` | Insert content at any position |
| `delete_lines` | Remove a line range |
| `list_dir` | Explore directory structure |
| `grep_search` | Regex/literal search across files |
| `run_command` | Execute shell commands (120s timeout, timeout-aware) |

### 🧠 Agent Intelligence
| Feature | Detail |
|---------|--------|
| **Plan-first** | Outlines steps and asks for approval before executing |
| **Repetition detection** | Stops if the same tool call is looping |
| **History compression** | Old rounds summarized via `gemini-2.0-flash` to save tokens |
| **Safety guardrails** | Destructive commands require user `[y/N]` confirmation |

### 💰 Cost & Observability
| Feature | Command / Flag |
|---------|---------------|
| Cost tracking | `/cost` — per-call and session totals |
| Prompt debugging | `DEBUG_PROMPTS=1` — dumps full prompt to stdout |
| Response debugging | `DEBUG_RESPONSE=1` — dumps raw model output |

### 💾 Session Persistence
The agent saves its conversation summary to `.agent-session.json` when you exit, and automatically restores context on the next startup — so you can resume tasks across restarts.

```
📂 Previous session restored (4 Mar 2026, 2:30 PM)
   Scaffolded Spring AI project. Created pom.xml and added milestone repo.
   mvn clean install timed out at step 3 of 6.
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Gemini API key ([get one free](https://aistudio.google.com))

### Setup
```bash
git clone https://github.com/ashishbhutani/coding-agent
cd coding-agent
npm install
cp .env.example .env
# Add your GEMINI_API_KEY to .env
```

### Running
```bash
# Run from a project directory (not the agent codebase itself)
cd /path/to/your/project
npm run dev --prefix /path/to/coding-agent

# Or add to .zshrc for convenience:
alias coding-agent='npm run dev --prefix /path/to/coding-agent'
```

### Commands
```
/help           — Show all commands
/cost           — Session cost breakdown
/cost reset     — Reset cost tracking
/session        — Show previous session summary
/session clear  — Delete saved session
/clear          — Clear conversation history
/verbose        — Toggle verbose mode
/tools          — List available tools
/exit           — Save session and exit
```

---

## Design Choices

**No LangChain.** Every abstraction in this repo is visible and editable. When something breaks, there's no framework internals to debug.

**Cheap model for compression.** `gemini-2.5-pro` handles reasoning; `gemini-2.0-flash` (free tier) handles conversation summarization. This keeps history manageable without burning tokens.

**Timeout-aware commands.** `run_command` detects exit code 143 (SIGTERM) and tells the model *"timed out — retry with a higher timeout_ms"* rather than a cryptic failure.

**Plan before execution.** The system prompt requires the agent to outline steps and get approval before executing multi-step tasks, reducing wasted token rounds on failed attempts.

---

## Roadmap

### Near-term
- [ ] **Two-model routing** — route simple queries to gemini-2.0-flash, complex ones to gemini-2.5-pro (~60% cost reduction)
- [ ] **File read caching** — avoid re-reading unchanged files within a session
- [ ] **Gemini context caching** — cache system prompt to reduce per-call cost

### Multi-Agent System (Phase 2 & 3)
- [ ] **Planner agent** — breaks a task into a structured, dependency-aware task board
- [ ] **Worker agents** — claim and execute tasks from the board
- [ ] **Crash recovery** — stale task detection and work stealing between workers
- [ ] **Parallel execution** — multiple workers running simultaneously

See the [full multi-agent PRD](./docs/multi-agent-prd.md) for details.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js + TypeScript |
| LLM | Google Gemini (via `@google/generative-ai`) |
| Testing | Vitest |
| CLI | readline-sync + chalk |
| Dependencies | Minimal — no agent framework |

---

## Built With

This project is developed in a **human-AI pair programming** model:

- **Human ([@ashishbhutani](https://github.com/ashishbhutani))** — product direction, architecture decisions, feature design, code review
- **AI (Antigravity, Google DeepMind)** — implementation, tests, commits, iteration

All commits are co-authored to reflect this.

---

## Contributing

This is a personal learning project, but PRs and issues are welcome.

```bash
npm test          # Run all 104 tests
npm run dev       # Start the agent
```
