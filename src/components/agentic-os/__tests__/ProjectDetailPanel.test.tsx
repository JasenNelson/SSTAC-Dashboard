import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import ProjectDetailPanel, { type PatternASkill } from '../ProjectDetailPanel';
import type { Project } from '@/lib/agentic-os/parse-projects-map';
import { TOOLTIPS } from '@/lib/agentic-os/status-helpers';

// NIT-2 coverage: the `launchingFor` prop changed from `string | null`
// (single in-flight slot) to `ReadonlySet<string>` so concurrent launches
// across different rows do not race. These tests verify that:
//   1. Multiple keys present in the Set independently mark their buttons busy.
//   2. A key for project A does NOT mark project B's same-action button busy.
//   3. An empty / undefined Set leaves all buttons enabled.

const skills: ReadonlyArray<PatternASkill> = [
  { action: 'run_safe_exit', label: '/safe-exit', slash: '/safe-exit' },
  { action: 'run_update_docs', label: '/update-docs', slash: '/update-docs' },
];

const tooltips = TOOLTIPS;

const projectA: Project = {
  name: 'Project-A',
  path: 'C:\\Projects\\Project-A',
  status: 'active',
  tags: [],
  purpose: 'fixture',
  extras: {},
};

describe('ProjectDetailPanel — launchingFor Set semantics (NIT-2)', () => {
  it('marks ONLY the buttons whose concurrencyKey is in the Set as busy', () => {
    const onLaunch = vi.fn();
    const launchingFor = new Set<string>(['Project-A::run_safe_exit']);
    render(
      <ProjectDetailPanel
        project={projectA}
        tooltips={tooltips}
        onLaunch={onLaunch}
        launchingFor={launchingFor}
        patternASkills={skills}
      />,
    );

    const safeExitBtn = screen.getByRole('button', { name: /\/safe-exit/ });
    const updateDocsBtn = screen.getByRole('button', { name: /\/update-docs/ });
    expect(safeExitBtn).toBeDisabled();
    expect(updateDocsBtn).not.toBeDisabled();
  });

  it('does NOT bleed busy state across projects (different project::action key)', () => {
    // The Set contains a key for a DIFFERENT project. Project-A's buttons
    // should remain enabled.
    const launchingFor = new Set<string>(['Project-B::run_safe_exit']);
    render(
      <ProjectDetailPanel
        project={projectA}
        tooltips={tooltips}
        onLaunch={vi.fn()}
        launchingFor={launchingFor}
        patternASkills={skills}
      />,
    );

    const safeExitBtn = screen.getByRole('button', { name: /\/safe-exit/ });
    const updateDocsBtn = screen.getByRole('button', { name: /\/update-docs/ });
    const externalBtn = screen.getByRole('button', { name: /external/ });
    expect(safeExitBtn).not.toBeDisabled();
    expect(updateDocsBtn).not.toBeDisabled();
    expect(externalBtn).not.toBeDisabled();
  });

  it('handles undefined launchingFor (no in-flight launches) without crashing', () => {
    render(
      <ProjectDetailPanel
        project={projectA}
        tooltips={tooltips}
        onLaunch={vi.fn()}
        launchingFor={undefined}
        patternASkills={skills}
      />,
    );

    const safeExitBtn = screen.getByRole('button', { name: /\/safe-exit/ });
    expect(safeExitBtn).not.toBeDisabled();
  });

  it('marks BOTH a Pattern A skill button AND the wt.exe external button busy when both keys are present', () => {
    // This is the concurrent-launch case NIT-2 was filed for: the old single
    // string would have overwritten one with the other.
    const launchingFor = new Set<string>([
      'Project-A::run_safe_exit',
      'Project-A::open_session',
    ]);
    render(
      <ProjectDetailPanel
        project={projectA}
        tooltips={tooltips}
        onLaunch={vi.fn()}
        launchingFor={launchingFor}
        patternASkills={skills}
      />,
    );

    const safeExitBtn = screen.getByRole('button', { name: /\/safe-exit/ });
    const externalBtn = screen.getByRole('button', { name: /external/ });
    const updateDocsBtn = screen.getByRole('button', { name: /\/update-docs/ });
    expect(safeExitBtn).toBeDisabled();
    expect(externalBtn).toBeDisabled();
    expect(updateDocsBtn).not.toBeDisabled();
  });
});
