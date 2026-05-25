---
tracker:
  kind: linear
workspace:
  root: ./tmp/workspaces
agent:
  max_concurrent_agents: 1
codex:
  command: codex app-server
  turn_timeout_ms: 300000
  task_timeout_ms: 1200000
---

You are working on a Linear issue for chess-3d-15.
This is a clean product repository. Build only what the issue and graph task ask for.
Relative workspace roots are resolved under Symphony's sterile temp workspace base, not under this product repo.
