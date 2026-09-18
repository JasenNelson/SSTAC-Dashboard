# Private asset deployment proposal

The opaque server route accepts only a catalog-owned packageId. It never joins
or reads a user-controlled path. The package catalog and producer are null in
this candidate, so the route returns 503 with no-store and nosniff.

Before integration, bind real PDF/DOCX bytes, exact SHA-256 and byte length,
and a private locator under a reviewed server-only directory outside public/.
The deployment owner must approve an exact Next.js outputFileTracingIncludes
entry for the selected private assets, prove no public direct bypass, and run
the route hash/length verification before streaming. No next.config, package,
or deployment change is included here.
