
## 2024-05-18 - [SQL Injection Prevention in LIMIT/OFFSET and ORDER BY Clauses]
**Vulnerability:** Found unparameterized template string variables used in `LIMIT`, `OFFSET`, and `ORDER BY` clauses within SQLite database wrappers (e.g., in `src/lib/sqlite/queries/index.ts`).
**Learning:** SQLite drivers like `better-sqlite3` fully support parameterization for `LIMIT` and `OFFSET` numeric values, contrary to some older SQL dialects. `ORDER BY` clauses, however, cannot natively parameterize column names in SQLite and require strict backend whitelist validation before template injection.
**Prevention:** Always use `?` parameterization for numeric boundary clauses (`LIMIT`/`OFFSET`). For sorting directives (`ORDER BY`), validate the incoming column string strictly against a predefined array of allowed column names before injecting it into the query.
