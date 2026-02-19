---
description: how to handle git commits for this project
---

# Git Commit Workflow

// turbo-all

## Rules

1. Make **small, atomic commits** — one logical change per commit.
2. Commit after each working step, not in big batches.
3. Use **conventional commit** prefixes:
   - `feat:` — new feature or tool
   - `fix:` — bug fix
   - `test:` — adding or updating tests
   - `refactor:` — restructuring without behavior change
   - `docs:` — documentation only
   - `chore:` — deps, config, cleanup
4. Keep commit messages concise but descriptive.
5. Always verify the change works (tests pass or manual check) before committing.

## Example workflow

```bash
# After adding a new tool:
git add src/tools/new-tool.ts src/tools/index.ts
git commit -m "feat: add new_tool for X"

# After writing tests for it:
git add src/tools/new-tool.test.ts
git commit -m "test: add unit tests for new_tool"

# After fixing a bug:
git add src/llm/gemini.ts
git commit -m "fix: correct Gemini schema conversion for nested arrays"
```
