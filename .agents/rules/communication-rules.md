---
trigger: always_on
---

# Agent Rules and Standards

## Communication Rules

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

## Security and Operational Rules

| Rule | Restriction | Requirement |
|---|---|---|
| Network Calls | Blocked by default | Must ask user permission before making any network call. |
| Project Boundary | Workspace only | Never go outside the project directory. |
| Deletions | Strictly protected | Never delete files, folders, pages, or database records without explicit user permission. |
| Git Operations | Read-only status | Only `git status` is allowed. Never run `git add`, `git commit`, or `git push`. |

## Execution Guidelines

- Always ask the user before deleting any item or sending network requests.
- Keep all repository files, docstrings, and tests in English.
- Avoid em-dashes throughout all files and communications.
