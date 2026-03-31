## 2024-05-24 - [SQL Injection] Parameterize LIMIT and OFFSET in better-sqlite3 queries
**Vulnerability:** Template literal string interpolation for `LIMIT` and `OFFSET` clauses in `getAssessments` allowed a potential SQL injection path, since these values are often parsed from unvalidated request URLs.
**Learning:** `better-sqlite3` supports parameterized placeholders (`?`) for both `LIMIT` and `OFFSET` numeric values.
**Prevention:** Always push limit/offset numerical values to the `params` array and append `?` in the query builder rather than concatenating them into the raw SQL template string.
