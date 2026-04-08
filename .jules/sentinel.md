
## 2024-05-28 - [SQL Injection in SQLite Dynamic Queries]
**Vulnerability:** SQL Injection via untrusted parameters interpolated into query strings (`ORDER BY ${orderBy}` and `LIMIT ${filters.limit}`).
**Learning:** Even though parameter types might be strongly typed in TypeScript, dynamically built SQLite query strings without parameters risk injection if runtime data skips validation. The `better-sqlite3` library executes whatever string it receives.
**Prevention:** Always whitelist dynamic identifiers (e.g., column names for `ORDER BY`) and use parameterized `?` placeholders for literal values (like `LIMIT` and `OFFSET`) when building dynamic queries.
