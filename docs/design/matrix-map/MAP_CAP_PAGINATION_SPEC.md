# MAP CAP PAGINATION SPEC

## Deferred Future Work

This document outlines the rationale for deferring true offset/keyset pagination in favor of a minimal fix.

**The Chosen Minimal Fix vs. Deferred Option**
The chosen minimal fix is to raise `v_cap` from 2500 to 5000. This safely covers the current province-wide dataset of 4486 samples with headroom. The deferred option is true offset or keyset pagination, which would require a function-SIGNATURE change and a client-contract change.

**Why Deferred**
A `CREATE OR REPLACE` operation using the SAME single-argument signature preserves the function OWNER (`matrix_map_owner`, which serves as the `SECURITY DEFINER` identity) along with existing grants. Implementing a signature change or performing a drop-and-recreate risks an ownership reset to `postgres` and a default `EXECUTE` grant to `PUBLIC`, which constitutes a security regression.

**Trigger to Revisit**
If the dataset grows substantially past 5000 province-wide, we must implement keyset pagination (cursor by sample ID) behind the existing RPC. This approach will preserve the `SECURITY DEFINER` identity, the grants, and the province-wide hidden-summary contract.

**Existing Mitigations for Dataset > Cap**
The application already has mitigations in place to handle counts that exceed the cap:
- The honest `truncated` flag.
- The zoom banner ("Showing N of M -- zoom in to see all").
- The viewport refetch logic (triggered at zoom >= 7) which pages by geography.
