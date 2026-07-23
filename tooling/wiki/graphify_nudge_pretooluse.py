#!/usr/bin/env python
import sys
import json
import re
import shlex
import os

def _emit(context):
    out = {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "additionalContext": context,
        }
    }
    sys.stdout.write(json.dumps(out))

def should_fire(command):
    # 1. Check PowerShell literal regex before tokenization
    # "Get-ChildItem -Recurse | Select-String somepattern"
    ps_pattern = r"(?i)get-childitem.*?-recurse.*?\|\s*select-string\s+\S+"
    if re.search(ps_pattern, command):
        return True

    # 2. Tokenize and split by clauses. Shell operators glued to adjacent
    # words with no whitespace (`cd docs;rg trust`, `echo ok&&rg trust`) are
    # NOT split apart by shlex on their own (verified empirically) -- pad them
    # with spaces first so they always become standalone tokens. This can
    # rarely mis-tokenize an operator character that appears literally inside
    # a quoted argument; acceptable for a non-blocking advisory nudge (worst
    # case: an imprecise fire/no-fire decision, never a blocked command).
    # KNOWN LIMITATION (codex-flagged, accepted): an escaped/literal operator
    # char inside a search PATTERN (e.g. `rg "foo\|bar" docs/`, a regex
    # alternation) gets split into an extra bogus token here, which can push
    # the clause over the "more than one path operand" guard below and
    # suppress a nudge that arguably should have fired. Narrow, P3, and only
    # ever a missed reminder -- not worth a quote-aware tokenizer rewrite for
    # an advisory-only feature. Revisit only if this proves to matter in
    # practice.
    padded = re.sub(r'(\|\||&&|[;|])', r' \1 ', command)
    try:
        tokens = shlex.split(padded, posix=True)
    except ValueError:
        # Unbalanced quotes, treat as ambiguous for rg/grep
        return False

    if not tokens:
        return False

    # Split into clauses by unquoted &&, ;, | -- tag each clause with
    # whether it was fed by a PIPE specifically (as opposed to starting a
    # fresh command after ; or &&), since a piped-into grep/rg is usually
    # filtering another command's stdout, not searching the repo.
    clauses = []
    current_clause = []
    current_piped_in = False
    for t in tokens:
        if t in ('&&', ';', '|'):
            if current_clause:
                clauses.append((current_clause, current_piped_in))
                current_clause = []
            current_piped_in = (t == '|')
        else:
            current_clause.append(t)
    if current_clause:
        clauses.append((current_clause, current_piped_in))

    allowlist = {'docs', 'tooling', 'src', 'scripts', 'supabase', 'e2e'}

    for clause, clause_piped_in in clauses:
        if not clause:
            continue

        cmd = clause[0]
        if cmd not in ('rg', 'grep', 'rg.exe', 'grep.exe'):
            continue
            
        i = 1
        pattern = None
        paths = []
        ambiguous = False
        has_files_flag = False
        
        while i < len(clause):
            t = clause[i]
            if t.startswith('-'):
                if t in ('--files', '-l', '--files-with-matches'):
                    has_files_flag = True
                    i += 1
                elif t in ('-n', '-i', '--line-number', '--hidden', '-R', '-r', '--recursive'):
                    i += 1
                elif t in ('--glob', '-g', '--type', '-t'):
                    i += 2
                else:
                    ambiguous = True
                    break
            else:
                if pattern is None:
                    pattern = t
                else:
                    paths.append(t)
                i += 1

        if ambiguous or has_files_flag or pattern is None:
            continue
            
        if len(paths) > 1:
            continue
            
        if len(paths) == 0:
            # A bare pattern with no path is ambiguous when fed by a pipe --
            # `git log | grep fix` / `python x.py | grep ERROR` are stdin
            # filters on another command's output, not repo searches (codex
            # P3). Only treat "no path" as "search the whole repo" when this
            # is the pipeline's own first clause (nothing piped into it).
            if not clause_piped_in:
                return True
            continue

        if len(paths) == 1:
            path = paths[0]
            if path == '.':
                return True
            clean_path = path.rstrip('/')
            if clean_path in allowlist:
                return True

    return False

def get_main_root(root_dir):
    if "FAKE_GIT_COMMON_DIR" in os.environ:
        return os.path.dirname(os.environ["FAKE_GIT_COMMON_DIR"])
    try:
        import subprocess
        res = subprocess.run(["git", "-C", root_dir, "rev-parse", "--git-common-dir"], capture_output=True, text=True, timeout=5)
        if res.returncode == 0 and res.stdout.strip():
            common_dir = os.path.abspath(os.path.join(root_dir, res.stdout.strip()))
            return os.path.dirname(common_dir)
    except Exception:
        pass
    return root_dir

def main():
    # KILL-SWITCH (easy disable without editing settings.json): set
    # SSTAC_WIKI_HOOKS_OFF=1 to make every wiki hook a silent no-op.
    if os.environ.get('SSTAC_WIKI_HOOKS_OFF'):
        return 0
    try:
        raw = sys.stdin.read()
        if not raw or not raw.strip():
            return 0
        payload = json.loads(raw)
        if not isinstance(payload, dict):
            return 0
        
        if payload.get("tool_name") != "Bash":
            return 0
            
        command = (payload.get("tool_input") or {}).get("command") or ""
        if not command:
            return 0
            
        if should_fire(command):
            configured_runtime = os.environ.get("SSTAC_WIKI_RUNTIME_ROOT")
            root_dir = configured_runtime or os.environ.get("WIKI_BOOTSTRAP_ROOT", os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
            local_graph = os.path.join(root_dir, 'wiki', '.graph', 'graph.json')
            graphify_exe = os.path.join(root_dir, '.venv-graphify', 'Scripts', 'graphify.exe')
            
            if os.path.exists(local_graph):
                card = (
                    "GRAPHIFY NUDGE: You are running a broad repository search.\n"
                    "For non-trivial exploration or unfamiliar-subsystem analysis, "
                    "please consider checking the graphify index first to orient yourself:\n"
                    f"`\"{graphify_exe}\" query \"<question>\" --graph \"{local_graph}\"`\n"
                    "(See AGENTS.md for the Graphify Usage Requirement, or wiki indexes as a fallback)."
                )
                _emit(card)
            else:
                if configured_runtime:
                    return 0
                main_root = get_main_root(root_dir)
                main_graph = os.path.join(main_root, 'wiki', '.graph', 'graph.json')
                if os.path.exists(main_graph):
                    main_indexes = os.path.join(main_root, 'wiki', '03_Indexes')
                    main_graphify_exe = os.path.join(main_root, '.venv-graphify', 'Scripts', 'graphify.exe')
                    card = (
                        "GRAPHIFY NUDGE: You are running a broad repository search.\n"
                        "For non-trivial exploration or unfamiliar-subsystem analysis, "
                        "please consider checking the graphify index first to orient yourself:\n"
                        f"`\"{main_graphify_exe}\" query \"<question>\" --graph \"{main_graph}\"` (main checkout)\n"
                        f"or read the wiki indexes at {main_indexes}\n"
                        "(See AGENTS.md for the Graphify Usage Requirement)."
                    )
                    _emit(card)
                    
        return 0
    except Exception:
        # Fail-open
        return 0

if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        sys.exit(0)
