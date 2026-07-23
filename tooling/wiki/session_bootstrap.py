import os
import sys
import re
import datetime
import time

def _newest_dated(repo_dir, prefix):
    best_name, best_key = None, None
    try:
        for name in os.listdir(repo_dir):
            if not name.startswith(prefix) or not name.endswith('.md') or '.pre-' in name:
                continue
            if not os.path.isfile(os.path.join(repo_dir, name)):
                continue
            m = re.search(r'\d{4}_\d{2}_\d{2}', name)
            if not m:
                continue
            key = m.group(0)
            if best_key is None or key > best_key:
                best_key, best_name = key, name
    except OSError:
        pass
    if best_name:
        return best_name
    return None

def _divergence_line(behind, ahead):
    if ahead > 0 and behind > 0:
        return ("GIT STATE: local main DIVERGED from origin/main (ahead %d / behind %d) -- do NOT "
                "build on local main; create a fresh worktree/branch off origin/main. Resolving the "
                "divergence is owner-gated (L0 1.4)." % (ahead, behind))
    if ahead > 0:
        return "GIT STATE: local main is %d commit(s) AHEAD of origin/main (unpushed)." % ahead
    if behind > 0:
        return ("GIT STATE: local main is %d commit(s) BEHIND origin/main (stale -- fetch/pull "
                "before building)." % behind)
    return None

def _git_state(root_dir):
    lines = []
    try:
        import subprocess
        def _git(args):
            return subprocess.run(["git", "-C", root_dir] + args, capture_output=True, text=True, timeout=10)
        cnt = _git(["rev-list", "--left-right", "--count", "origin/main...main"])
        if cnt.returncode == 0 and cnt.stdout.strip():
            parts = cnt.stdout.split()
            if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                line = _divergence_line(int(parts[0]), int(parts[1]))
                if line:
                    lines.append(line)
        st = _git(["status", "--porcelain", "--untracked-files=normal"])
        if st.returncode == 0 and st.stdout:
            untracked = [ln[3:].rstrip("/") for ln in st.stdout.splitlines() if ln.startswith("?? ")]
            if untracked:
                shown = ", ".join(untracked[:10])
                more = "" if len(untracked) <= 10 else " (+%d more)" % (len(untracked) - 10)
                lines.append("PARKED/UNTRACKED (do NOT stage or delete without checking): " + shown + more)
    except Exception:
        return []
    return lines

def get_main_root(root_dir):
    if "FAKE_GIT_COMMON_DIR" in os.environ:
        return os.path.dirname(os.environ["FAKE_GIT_COMMON_DIR"])
    try:
        import subprocess
        res = subprocess.run(["git", "-C", root_dir, "rev-parse", "--git-common-dir"], capture_output=True, text=True, timeout=10)
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
        root_dir = os.environ.get("WIKI_BOOTSTRAP_ROOT", os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        
        wiki_dir = os.path.join(root_dir, 'wiki')
        main_root = get_main_root(root_dir)
        main_wiki_dir = os.path.join(main_root, 'wiki')
        
        if not os.path.exists(wiki_dir):
            if os.path.exists(main_wiki_dir):
                idx = os.path.join(main_wiki_dir, '03_Indexes')
                print(f"KB lives in the main checkout -- wiki indexes (read-only): {os.path.join(idx, '000-Modules.md')} + 000-Concepts.md")
            else:
                print("KB wiki not built here; /sync-wiki builds it (main checkout only)")
            sys.exit(0)

        out = []
        out.append("PROJECT ORIENTATION (consult wiki indexes BEFORE repo-wide grepping).")
        out.extend(_git_state(root_dir))
        
        out.append("READ-FIRST FILES:")
        out.append("CLAUDE.md")
        out.append("docs/GATE_MODE_SOP.md")
        out.append("docs/INDEX.md")
        
        handoff = _newest_dated(root_dir, "FRESH_SESSION_HANDOFF_")
        if handoff:
            out.append(f"{handoff} (newest handoff)")
            
        plan = _newest_dated(root_dir, "NEXT_SESSION_HANDOFF_")
        if plan:
            out.append(f"{plan} (current plan)")

        modules_index = os.path.join(wiki_dir, '03_Indexes', '000-Modules.md')
        module_names = []
        if os.path.exists(modules_index):
            with open(modules_index, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                links = re.findall(r'\[\[([^\]]+)\]\]', content)
                for name in links:
                    if name not in module_names:
                        module_names.append(name)
                        
        count = len(module_names)
        recent = module_names[:8]
        if count > 0:
            out.append(f"Modules: {count}. Recent: {', '.join(recent)}")
            
        build_stamp_path = os.path.join(wiki_dir, '.build-stamp')
        if os.path.exists(build_stamp_path):
            with open(build_stamp_path, 'r', encoding='utf-8', errors='ignore') as f:
                out.append(f"Build stamp: {f.read().strip()}")
        
        graph_report = os.path.join(wiki_dir, '.graph', 'GRAPH_REPORT.md')
        hubs = []
        if os.path.exists(graph_report):
            with open(graph_report, 'r', encoding='utf-8', errors='ignore') as f:
                for line in f:
                    if line.startswith('### Community ') and '"' in line:
                        hubs.append(line.strip())
                        if len(hubs) >= 6:
                            break
        if hubs:
            out.append("GRAPH HUBS:")
            for hub in hubs:
                out.append(hub)
                
        out.append("QUERY TOOLS:")
        out.append('.venv-graphify/Scripts/graphify query "<question>" --graph wiki\\.graph\\graph.json')
        out.append('/sync-wiki   (recompile if wiki is stale)')
        
        stale = False
        latest_stamp = None
        for r, d, files in os.walk(wiki_dir):
            for file in files:
                if file.endswith('.md'):
                    try:
                        with open(os.path.join(r, file), 'r', encoding='utf-8', errors='ignore') as f:
                            head = f.read(512)
                            m = re.search(r'last_compiled:\s*"?(\d{4}-\d{2}-\d{2})', head)
                            if m:
                                stamp = m.group(1)
                                if latest_stamp is None or stamp > latest_stamp:
                                    latest_stamp = stamp
                    except Exception:
                        pass
                        
        if latest_stamp:
            try:
                stamp_date = datetime.datetime.strptime(latest_stamp, "%Y-%m-%d")
                if (datetime.datetime.now() - stamp_date).days > 3:
                    stale = True
            except Exception:
                pass
        
        graph_json = os.path.join(wiki_dir, '.graph', 'graph.json')
        if os.path.exists(graph_json):
            try:
                mtime = os.path.getmtime(graph_json)
                if (time.time() - mtime) > 3 * 24 * 3600:
                    stale = True
            except Exception:
                pass
                
        if stale:
            out.append("WIKI MAY BE STALE -- run /sync-wiki")
            
        print('\n'.join(out))
    except Exception:
        pass
    sys.exit(0)

if __name__ == '__main__':
    main()
