## 2024-04-13 - SQL Injection in pagination limits
**Vulnerability:** String concatenation used for LIMIT and OFFSET in SQLite queries (e.g., in `getAssessments`).
**Learning:** better-sqlite3 supports parameters for LIMIT and OFFSET, but developers sometimes default to string concatenation, creating a vector if pagination inputs are untrusted.
**Prevention:** Always use `?` placeholders and add values to the `params` array for all user-provided query variables, including pagination boundaries.
