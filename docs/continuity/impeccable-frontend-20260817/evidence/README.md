# Evidence tree -- impeccable frontend lane, 2026-08-17

This directory is the committed, remotely-durable mirror of the lane's local checkpoint at

    C:\Projects\SSTAC-Dashboard-worktrees\triage-20260816\.tmp\mission-control\impeccable-frontend-20260817\

It exists so the lane's load-bearing context survives session exit, reboot, and loss of the local
scratch tree. Nothing here is source code; nothing here affects the build.

## Layout

    reviews/         every reviewer round: tier-0 cursor, the three Opus legs, both codex rounds,
                     and the bounded adjudication of every codex finding
    gates/           six-gate receipts for both pre-merge combined trees, the two RED first
                     attempts (retained deliberately), the landed-main run, the runner itself,
                     the flake analysis, and the prior session's freeze receipts
    corrections/     the three correction reports, each with the exact two-sided falsification
                     messages observed when the bug was reintroduced
    verification/    rendered-browser verification, and the exact PR/commit mapping plus merge
                     evidence (merge commits, bases, timestamps, branch protection, publication)
    prompts/         the exact reviewer prompts used, retained for reproducibility

`../EVIDENCE_MANIFEST.json` and `../EVIDENCE_SHA256.txt` describe and hash the LOCAL checkpoint,
which is the authoritative copy. `../CLOSEOUT_2026_08_17.md` is the narrative closeout and
`../RESUME.md` is the fresh-session entry point.

## ASCII sanitization -- read this before comparing hashes

This repository requires plain ASCII (code point <= 127) in committed documentation. Four preserved
artifacts are verbatim third-party tool output and contained ANSI terminal escape sequences and a
small number of Unicode punctuation characters. Rather than mutate the local originals, ASCII-clean
copies were produced for this committed mirror. They carry an `.ascii` infix in the filename.

The sanitization stripped ANSI escape sequences and transliterated Unicode punctuation to ASCII
equivalents (curly quotes to straight, en/em dashes to `--`, arrows to `->`, ellipsis to `...`,
bullets to `-`, non-breaking space to space). No review finding, verdict, severity, file reference,
or line number was altered. Substance was spot-checked after conversion.

Five files are affected. Four are listed immediately below; the fifth is
`reviews/codex-luna-round1-SANDBOX-BLOCKED.ascii.txt`, the transcript of the codex round that
silently bailed because its tool router rejected every git and shell command. That round produced no
review, but it is retained because the closeout's review table cites it and because the lesson is
reusable: in this environment codex cannot run git, so diffs must be supplied inline.

The RAW originals remain in the local checkpoint with these SHA-256 values, so anyone holding that
tree can confirm the committed copies derive from them:

    c8e3483ac605432a0468a505e61deca57c56fcb8286dfb56d22760cf14168ef2  evidence/reviews/tier0-cursor-auto.md
    15d4d9645b6bc2f9ab8969d4d0ddc07950b874946f41de17b84b27244c1c6071  evidence/reviews/codex-luna-round2.txt
    5faea218808e9b8c2a85ec760041f3b7d14f6c6edd6e0f4a5414f2962273b57c  evidence/reviews/codex-sol-xhigh-shipgate.txt
    eb339ff752e1b0c0762fdb6783bbe57baf6386fbca781e0067649cd9eb1eac5c  evidence/corrections/correction-787-report.md

## Deliberately not preserved

    node_modules                    a junction to the shared store; never copied (see the junction
                                    hazard note in the closeout)
    browser profiles and caches
    build caches and .next output
    package caches
    credentials, .env / .env.local  never read, never copied
    raw per-gate e2e/unit/build/lint/tsc logs
                                    each six-gate run has a complete bounded RESULT.txt receipt,
                                    and the only two failure blocks that mattered are extracted
                                    verbatim into gates/flake-evidence.md
    large prompt bodies whose payload is git diffs
                                    cursor_review_impeccable.md and codex_inline_diffs.txt are
                                    fully reconstructible from the recorded commit SHAs
    landed-print.pdf                a 636 KB rendered PDF; kept in the local checkpoint only -- it
                                    is the ONLY manifest entry with no counterpart in this committed
                                    mirror. The
                                    print evidence that matters is textual and is recorded in
                                    verification/browser-verification.md, including the Playwright
                                    print-media specs that passed on the landed tree.
