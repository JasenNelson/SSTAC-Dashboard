## 2025-02-09 - Parameterized LIMIT/OFFSET & strict ORDER BY whitelist
**Vulnerability:** SQL injection risks due to unsafe string interpolation of `ORDER BY` identifiers, `LIMIT`, and `OFFSET` variables directly into query strings in `better-sqlite3`.
**Learning:** Raw string interpolation for pagination and ordering can easily bypass TypeScript typing at runtime if external unsanitized variables are passed in. Identifiers like `ORDER BY` columns cannot be parameterized using standard `?` syntax.
**Prevention:** Use `?` placeholders strictly for values like `LIMIT` and `OFFSET`. For `ORDER BY` and other structure modifiers, always validate input against a strict array whitelist of allowed strings before interpolating.
