---
name: GitHub CLI authorization
description: GitHub source-control connection status may not match the Agent shell's GitHub CLI credentials.
---

For GitHub repository publishing, do not assume that a connected GitHub source-control integration means the Agent shell can push. Verify with `gh auth status` and a non-interactive push attempt before claiming the repository is updated. If the shell is unauthenticated, have the user complete `gh auth login` in the Replit Shell or connect the repository through Replit's Git pane; never ask them to paste a token into chat.

**Why:** A GitHub connection reported as active while `gh` had no logged-in account and GitHub rejected a push with invalid credentials.

**How to apply:** Before pushing a project or configuring GitHub Pages through authenticated GitHub commands, verify the CLI authorization independently of the integration status.
