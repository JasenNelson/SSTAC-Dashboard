---
name: test-agent
description: An E2E fixture agent used by the Playwright Agentic OS spec.
---

# test-agent

This file exists only so the project-scoped agent-discovery layer has
something to find during the Playwright E2E run. It does not describe a
working agent; the launch route's spawn step is stubbed in E2E mode so
executing it never produces side effects beyond `[stub] launched ...`.
