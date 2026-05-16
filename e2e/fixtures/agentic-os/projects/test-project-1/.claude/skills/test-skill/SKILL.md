---
name: test-skill
description: An E2E fixture skill used by the Playwright Agentic OS spec.
---

# test-skill

This file exists only to give the skill-discovery layer something to find
during the Playwright E2E run. It is NOT a real skill and has no behavior;
the launch route's spawn step is stubbed in E2E mode so executing it never
produces any side effects beyond the canned `[stub] launched ...` lines.
