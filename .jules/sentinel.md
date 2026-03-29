## 2024-05-18 - [Fix SQL Injection in SQLite Queries]
**Vulnerability:** SQL Injection via template string interpolation in SQLite `LIMIT` and `OFFSET` clauses. Also unparameterized `ORDER BY` clause.
**Learning:** Even though `LIMIT` and `OFFSET` typically receive numbers, template string interpolation introduces a SQL Injection risk if the input is ever derived from an untrusted source without strict validation. `ORDER BY` cannot be parameterized in SQLite natively, requiring runtime validation against an allowed list of columns.
**Prevention:** Always use parameterized queries (`?`) for `LIMIT` and `OFFSET`. For dynamic `ORDER BY` columns, enforce a strict whitelist validation before appending to the SQL string.
