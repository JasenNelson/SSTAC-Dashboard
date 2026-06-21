# Banked HITL decisions -- owner morning review (2026-06-13)

Plain ASCII. Autonomous overnight session. These are decisions only the owner (J. Nelson) should
make; AI did NOT guess on them. Everything else proceeded autonomously (dual-verified + gated + shipped).

---

## 1. Worker receptor scenario -- BLOCKED on a regulatory-data-integrity decision

**Status:** the commercial/industrial WORKER receptor scenario (3rd receptor for the direct-contact
calculator) is fully buildable on the existing multi-receptor contract (#308) and would ship the same
way as toddler/adult -- EXCEPT it is blocked on ONE value the owner must adjudicate.

### The decision: worker total-body Skin Surface Area (SA) = 1640 or 16640 cm2?

Dual-verified against the HC PQRA v4.0 PRIMARY (Appendix E, doc p.69, "Skin surface area (cm2) /
Total body" row; fetched from publications.gc.ca, pypdf layout-mode extraction):

```
            Infant  Toddler  Child   Teen    Adult   Construction/Utility Worker   Source
Total body  3620    6130     10 140  15 470  17 640  1 640                          Richardson (1997)
```

- **The HC PDF LITERALLY PRINTS "1 640" for the worker.** The repo record
  `pv-hc-pqra-v4-2024-sa-total-worker-ca` = 1640 cm2 FAITHFULLY transcribes the source as printed.
- **But 1640 is internally IMPOSSIBLE.** The worker is a 70.7 kg adult (same body weight as the Adult
  column). Its OWN tabulated skin-region rows -- Hands 890 + Arms 2500 + Legs 5720 = 9110 cm2 for just
  three regions -- already exceed 1640 by 5.6x. A total body smaller than three of its own regions is
  physically impossible. Total body must be the LARGEST figure in each column (it includes head/trunk).
- **Almost certainly a TYPO in the HC document for 16,640** (a dropped leading "16"; 16,640 sits just
  below the adult 17,640, the expected magnitude since the worker shares the adult body weight).
- **No legitimate basis for 1640 as a PPE / exposed-skin concept.** Appendix E has no exposed-skin row;
  it pairs anatomical region/total-body areas with separate per-region soil-loading factors. The repo's
  prior uncertainty note framing "1640 = PPE/limited skin" is an over-interpretation not grounded in
  the source. (That note was authored in PR #302.)
- **Caveat:** no independent HC erratum was found, and Richardson (1997) was not accessible to confirm
  16,640. The "16640" reconstruction is a strong physical/internal-consistency INFERENCE, not a
  second-source confirmation.

### Why this was banked, not auto-corrected
Changing a regulatory value by OVERRIDING the primary-source-as-printed (1640) with an inferred value
(16640), without an erratum to cite, is a data-integrity decision the HITL should own. AI verified and
surfaced; AI did not unilaterally flip a Government-of-Canada published figure overnight.

### Owner options (pick one)
- **(A) Correct to 16640** with a record note: "HC PQRA v4.0 Appendix E prints '1 640' for the worker
  total-body SA; this is an apparent HC typesetting error for 16,640 (internally impossible as printed:
  < hands+arms+legs; worker shares the adult 70.7 kg body). Corrected to 16,640 on owner attestation."
  Then AI builds + ships the worker scenario (same loop as #308).
- **(B) Keep 1640 as-printed** (cite-the-source-verbatim policy) -- but then the worker dermal SA term
  is ~10x too small; the worker scenario should NOT be shipped with a known-impossible value.
- **(C) Defer worker** pending a Richardson (1997) check or an HC erratum search.

### The other 4 worker seeds: ALL CONFIRMED vs the primary (ready to promote)
- IR_sed worker = 100 mg/day (App. E soil ingestion, worker col; MassDEP 2002). CONFIRMED.
- EF commercial/industrial = 240 days/yr (Table 2: 5 d/wk x 48 wk/yr). CONFIRMED.
- ED commercial/industrial = 35 yr (Table 2). CONFIRMED.
- AF worker other-surfaces = 0.1 mg/cm2 (App. E, 1e-7 kg/cm2-event x1e6; Kissel). CONFIRMED.
- (BW-adult 70.7 + AT-cancer 80 already approved in #308.)

So on an (A) decision, the worker scenario is one verify-build-gate-ship loop away.

---

## 0. PROCESS SAFETY (check first) -- a runaway python is eating ~14.5 GB

As of ~07:33, ONE python process is a memory hog and likely the stability risk behind the earlier
crash:
- **PID 9540 -- ~14,804 MB RSS, ~91 CPU-min, started 2026-06-13 05:34 AM.** The other ~12 python
  processes are normal (4-162 MB).
- This is almost certainly NOT from this Claude session's tools: my python use was earlier, small
  pypdf PDF-extractions that exited; at 05:34 this session was running node-based CI gates, not
  python. It is most likely a PARALLEL session's long-running python (a Docling / DRA-KB ingest?) or
  a service that ballooned.
- I did NOT kill it (it is not clearly mine; killing it could destroy a parallel session's
  long-running work; per L0 1.9 + CLAUDE.md "ask owner before terminating"). 
- ACTION FOR YOU: check what PID 9540 is (`Get-Process -Id 9540 | Format-List *` or Task Manager ->
  Details -> CommandLine). If it is an orphan / runaway, `Stop-Process -Id 9540 -Force`. If it is a
  parallel session's intended ingest, leave it but watch RAM. 14.5 GB + an earlier crash is a real
  Windows-stability risk while the machine is unattended.

## 2. (Informational) python.exe crash during the session
A `python.exe` access violation (native C-extension fault, read at near-null 0x...0008) popped a
Windows dialog ~23:44. Single-process crash, safe to dismiss. 9 persistent python.exe (~86 MB each,
spanning the whole day) were observed but NOT terminated (parallel sessions / services may own them).
If they are orphans, `C:\Projects\Regulatory-Review\.claude\scripts\cleanup-orphans.ps1 -Force` clears
them. AI avoided python/pypdf subagents for the rest of the night as a precaution.

---

*Banked autonomously overnight 2026-06-13. Worker scenario + the other 4 confirmed values are ready;
only the SA 1640-vs-16640 call is yours.*
