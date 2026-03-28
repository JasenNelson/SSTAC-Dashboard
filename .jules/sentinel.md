## 2025-02-28 - [CRITICAL] Fix SQL Injection in getAssessments

**Vulnerability:** Found `LIMIT` and `OFFSET` values interpolated directly into a SQL query in `src/lib/sqlite/queries/index.ts`. This was a critical vulnerability that allowed an attacker to inject arbitrary SQL statements by passing them as `limit` and `offset` in API requests that map to the `getAssessments` function.
**Learning:** SQLite supports parameterization of `LIMIT` and `OFFSET` just like other query variables. Avoid using string interpolation (`${value}`) anywhere in the SQL query string in favor of `?`. Also learned that previously the query skipped limit if `filters.limit` was 0 due to truthiness evaluation.
**Prevention:** Strictly enforce that dynamic variables injected into raw SQL strings (including those for SQLite) are parameterized using `?` placeholders and appended to the `params` array. Do not trust user inputs, even when passed as numbers.
