import argparse
import copy
import json
import os
import sys
import tempfile
from pathlib import Path

# --- Bounded enhancement constants (Phase 3 port; see plan section 6) ---
DEMOTION_GRACE_RUNS = 2       # consecutive absent runs tolerated before demoting
CHURN_THRESHOLD = 0.30        # fraction of previously-active entries that may churn
CHURN_MIN_SAMPLE = 10         # floor below which the churn breaker never trips (avoids
                               # false trips on a tiny ledger where 1-2 edges are a large %)
COVERAGE_THRESHOLD = 0.90     # EDGE coverage (current INFERRED vs prior successful run)

def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--graph', required=True)
    parser.add_argument('--state', required=True)
    parser.add_argument('--commit', required=True)
    parser.add_argument('--report', action='store_true')
    # Coverage-guard enhancement: Phase 4/5's semantic step is expected to pass
    # --extract-status PARTIAL when a partial-completion drill or timeout truncated the
    # extract. Phase 3's one-time manual seed never passes this (defaults GREEN), so the
    # guard is INERT for the Phase 3 seed run.
    parser.add_argument('--extract-status', choices=['GREEN', 'PARTIAL'], default='GREEN')
    return parser.parse_args()

def main():
    args = parse_args()

    # Load graph
    with open(args.graph, 'r', encoding='utf-8') as f:
        graph = json.load(f)

    nodes = {n.get('id'): n for n in graph.get('nodes', []) if n.get('id')}

    # Extract links from graph
    current_inferred = {}
    current_all = {}
    for link in graph.get('links', []):
        src = link.get('source')
        tgt = link.get('target')
        rel = link.get('relation', 'references')
        if src and tgt:
            current_all[(src, tgt, rel)] = link
            if link.get('confidence') == 'INFERRED':
                current_inferred[(src, tgt, rel)] = link

    # Load state
    state_path = Path(args.state)
    state = {'v': 1, 'entries': {}}
    if state_path.exists():
        with open(state_path, 'r', encoding='utf-8') as f:
            state = json.load(f)

    entries = state.setdefault('entries', {})

    # --- COVERAGE GUARD (bounded enhancement) ---
    # Skip promotion ENTIRELY (no ledger mutation) when the extract that produced this
    # graph was not GREEN, or when the current INFERRED edge count has dropped >10% versus
    # the last successful run's baseline -- a partial/mis-scoped extract must never be
    # allowed to mass-demote real edges just because it saw fewer of them. First-ever run
    # (no baseline recorded yet) always seeds the baseline instead of skipping.
    coverage_baseline = state.get('coverage_baseline', {})
    prior_inferred_count = coverage_baseline.get('inferred_edge_count')

    skip_reason = None
    if args.extract_status != 'GREEN':
        skip_reason = f"extract_status={args.extract_status} (not GREEN)"
    elif prior_inferred_count is not None and prior_inferred_count > 0:
        coverage_ratio = len(current_inferred) / prior_inferred_count
        if coverage_ratio < COVERAGE_THRESHOLD:
            skip_reason = (
                f"edge coverage {coverage_ratio:.0%} < {COVERAGE_THRESHOLD:.0%} threshold "
                f"(current INFERRED={len(current_inferred)}, baseline={prior_inferred_count})"
            )

    if skip_reason:
        print(f"SUSPECT_PARTIAL: skipping promotion -- {skip_reason}")
        if args.report:
            counts = {}
            for entry in entries.values():
                counts[entry['status']] = counts.get(entry['status'], 0) + 1
            print("--- Promotion Report (read-only; promotion skipped this run) ---")
            for k, v in sorted(counts.items()):
                print(f"{k}: {v}")
            print("Newly promoted: 0")
            print("Newly demoted: 0")
        sys.exit(0)

    entries_before = copy.deepcopy(entries)
    prior_active_count = sum(
        1 for e in entries_before.values() if e.get('status') in ('inferred', 'promoted')
    )

    newly_promoted = 0
    newly_demoted = 0

    # Process current inferred links
    for key, link in current_inferred.items():
        src, tgt, rel = key
        key_str = f"{src}::{tgt}::{rel}"

        if key_str not in entries:
            entries[key_str] = {
                'first_seen': args.commit,
                'last_seen': args.commit,
                'seen_in': [args.commit],
                'status': 'inferred',
                'source': src,
                'target': tgt,
                'relation': rel,
                'absent_streak': 0,
            }
        else:
            entry = entries[key_str]
            entry['last_seen'] = args.commit
            entry['absent_streak'] = 0

            if entry['status'] == 'demoted':
                # REVIVAL (bounded fix; codex + Opus review 2026-07-17): a 'demoted' edge
                # reappearing as INFERRED must not stay permanently demoted. Restart its
                # promotion history from THIS sighting -- evidence from before the gap is
                # stale and should not count toward re-promotion.
                entry['status'] = 'inferred'
                entry['seen_in'] = [args.commit]
                entry['revived_at'] = args.commit
            else:
                if args.commit not in entry['seen_in']:
                    entry['seen_in'].append(args.commit)
                    if len(entry['seen_in']) > 10:
                        entry['seen_in'] = entry['seen_in'][-10:]

            if entry['status'] == 'inferred' and len(entry['seen_in']) >= 3:
                entry['status'] = 'promoted'
                entry['promoted_at'] = args.commit
                newly_promoted += 1

    # Check for demotions/retirements/revivals among existing entries. 'demoted' is
    # INCLUDED (not just 'inferred'/'promoted') so a demoted edge that reappears with
    # non-INFERRED (e.g. EXTRACTED) confidence -- skipping the INFERRED state entirely --
    # is also revived, matching the current_inferred-loop revival above.
    for key_str, entry in entries.items():
        if entry['status'] in ('inferred', 'promoted', 'demoted'):
            src = entry['source']
            tgt = entry['target']
            rel = entry['relation']

            key_tuple = (src, tgt, rel)

            if key_tuple not in current_all:
                # Link is ABSENT this run.
                if src in nodes and tgt in nodes:
                    # Both nodes still exist. DEMOTION GRACE (bounded enhancement):
                    # tolerate DEMOTION_GRACE_RUNS consecutive absences before demoting, so
                    # a single transient rebuild hiccup (e.g. a partial/incremental scan)
                    # does not immediately demote a stable edge. The streak resets to 0 the
                    # moment the edge is observed present again (see the "present" branch
                    # below and the current_inferred loop above).
                    entry['absent_streak'] = entry.get('absent_streak', 0) + 1
                    # Only count a FRESH demotion transition once -- an already-'demoted'
                    # entry that stays absent must not re-increment newly_demoted (and
                    # re-trip the churn breaker) on every subsequent run it remains gone.
                    if entry['status'] != 'demoted' and entry['absent_streak'] >= DEMOTION_GRACE_RUNS:
                        entry['status'] = 'demoted'
                        newly_demoted += 1
                else:
                    # At least one node is gone -- retire immediately. Grace does not apply
                    # to node deletion: a deleted node is not a transient scan hiccup.
                    entry['status'] = 'retired'
                    entry['absent_streak'] = 0
            else:
                entry['absent_streak'] = 0
                if key_tuple not in current_inferred:
                    # Link graduated to EXTRACTED or non-INFERRED -- promote/REVIVE (this
                    # also revives a 'demoted' edge that reappeared skipping the INFERRED
                    # state entirely, per the broadened outer filter above).
                    if entry['status'] != 'promoted':
                        entry['status'] = 'promoted'
                        entry['promoted_at'] = args.commit
                        newly_promoted += 1
                elif entry['status'] == 'demoted':
                    # Present again as INFERRED. Ordinarily the current_inferred loop
                    # above already revived this entry to 'inferred' before this loop
                    # runs; this is a defensive backstop in case this key was not visited
                    # there (kept equivalent to that revival for consistency).
                    entry['status'] = 'inferred'
                    entry['seen_in'] = [args.commit]
                    entry['revived_at'] = args.commit

    # --- CHURN CIRCUIT BREAKER (bounded enhancement) ---
    # Guards the ledger against mass damage from a single anomalous run (e.g. a partial or
    # mis-scoped graph rebuild that makes many real edges look absent at once). Only
    # DEMOTED/RETIRED transitions count as churn -- new promotions are not damage. The
    # CHURN_MIN_SAMPLE floor avoids false trips on a small ledger where one or two edges
    # are a large percentage by construction (including the very first run, where
    # prior_active_count is 0 and the breaker can never trip).
    churned = 0
    for key_str, entry in entries.items():
        before_status = entries_before.get(key_str, {}).get('status')
        after_status = entry.get('status')
        if after_status in ('demoted', 'retired') and before_status in ('inferred', 'promoted'):
            churned += 1

    if prior_active_count >= CHURN_MIN_SAMPLE and churned / prior_active_count > CHURN_THRESHOLD:
        print(
            f"CHURN CIRCUIT BREAKER TRIPPED: {churned}/{prior_active_count} "
            f"({churned / prior_active_count:.0%}) previously-active entries would be "
            f"demoted/retired this run (threshold {CHURN_THRESHOLD:.0%}). Aborting without "
            f"persisting -- investigate the graph rebuild before re-running promotion."
        )
        sys.exit(3)

    # Update the coverage-guard baseline: only a run that reached this point (not skipped,
    # not breaker-tripped) counts as "successful" for future coverage comparisons.
    state['coverage_baseline'] = {
        'inferred_edge_count': len(current_inferred),
        'commit': args.commit,
    }

    # Atomic write (ensure parent exists; temp file lives NEXT TO the target so
    # os.replace stays same-directory/same-volume)
    state_path.parent.mkdir(parents=True, exist_ok=True)
    temp_fd, temp_path = tempfile.mkstemp(dir=state_path.parent)
    with os.fdopen(temp_fd, 'w', encoding='utf-8') as f:
        json.dump(state, f, indent=2)
    os.replace(temp_path, state_path)

    if args.report:
        counts = {}
        for entry in entries.values():
            counts[entry['status']] = counts.get(entry['status'], 0) + 1

        print("--- Promotion Report ---")
        for k, v in sorted(counts.items()):
            print(f"{k}: {v}")
        print(f"Newly promoted: {newly_promoted}")
        print(f"Newly demoted: {newly_demoted}")

if __name__ == '__main__':
    main()
