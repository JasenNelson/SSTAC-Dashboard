Project Identity: SSTAC-Dashboard, Next.js/TypeScript/Supabase dashboard.

READ FIRST list:
- AGENTS.md (root)
- docs/AGENTS.md (RLS/RPC/API safety)
- docs/GATE_MODE_SOP.md (gate authority)

Rules:
- Build Gate: npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10
- Supabase writes via SQL-Editor protocol (MCP writes fail 100%)
- Never Rules: verdicts/catalogs/applied migrations/bulk git add/destructive git/ASCII/raw build/no-verify
- Worktree junction trap: node_modules is a junction, remove junction before deleting worktree
- Owner merges: never gh pr merge
