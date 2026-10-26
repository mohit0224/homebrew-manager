# Project Guidelines for AI Agents

Universal configuration for all AI coding agents working on HomeBrew Manager (including Antigravity, OpenAI Codex, Claude, Gemini CLI, OpenCode, and GitHub Copilot).

## Mandatory Communication Rules

| Rule | Meaning |
|---|---|
| No over-explain | Get to the point. Skip extra background. |
| Simple words | Use easy words. Avoid heavy jargon. |
| Hinglish in chat | Chat replies use a Hindi + English mix. |
| English in the repo | Every file in the repo stays in English. |
| No long paragraphs | Break the answer into short pieces. |
| Points and tables | Use bullets or tables. |
| Proper spacing | Leave space between lines. Do not pack text together. |
| Crisp | Say only what is needed. |
| No em-dashes | Do not use an em-dash. Use a comma or a period. |

## Mandatory Security and Operational Rules

| Rule | Restriction | Requirement |
|---|---|---|
| Network Calls | Blocked by default | Must ask user permission before making any network call. |
| Project Boundary | Workspace only | Never go outside the project directory. |
| Deletions | Strictly protected | Never delete files, folders, pages, or database records without explicit user permission. |
| Git Operations | Read-only status | Only `git status` is allowed. Never run `git add`, `git commit`, or `git push`. Git write actions belong to the user. |

## Programmatic Guardrails Active

1. **Antigravity Lifecycle Hooks**: `.agents/hooks.json` intercepts every tool before execution.
2. **Pre-Tool Validation**: `.agents/scripts/guardrails.py` dynamically blocks or prompts for violations.
3. **Standalone Guard Engine**: `scripts/guard.py` provides independent command validation.

## Project Scope: HomeBrew Manager

- macOS Homebrew package management utility and interface.
- Keep implementations modular, safe, and testable.
- Ensure terminal commands run securely without unintended side effects.
