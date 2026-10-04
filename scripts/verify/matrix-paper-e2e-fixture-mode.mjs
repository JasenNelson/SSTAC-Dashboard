const PRIVATE_FIXTURE_MODE_MESSAGE = 'MATRIX_PAPER_PRIVATE_FIXTURE must be `required` (the private release journeys run) or `skip` (they are skipped knowingly) outside GitHub Actions.';
const PRIVATE_FIXTURE_REQUIRED_MESSAGE = 'MATRIX_PAPER_PRIVATE_FIXTURE=required, but the private release journeys cannot run: MATRIX_OPTIONS_PAPER_PRIVATE_ASSET_DIR is unset or GITHUB_ACTIONS is true.';
const PRIVATE_FIXTURE_AUTH_MESSAGE = 'MATRIX_PAPER_PRIVATE_FIXTURE=required, but the authenticated project that runs the private release journeys is not enabled: E2E_AUTH_ENABLED must be true and the E2E test credentials must be set.';

const FIXTURE_MODE_BY_LEG = Object.freeze({
  'flags-off': 'skip',
  'authenticated-v16': 'skip',
  'appendix-l-inclusion-only': 'required',
});

export function privateFixtureModeForLeg(leg) {
  const mode = FIXTURE_MODE_BY_LEG[leg];
  if (!mode) throw new Error(`Unknown Matrix Options Paper E2E leg: ${leg}`);
  return mode;
}

export function privateReleaseJourneysEnabled({ mode, githubActions, fixturePresent }) {
  return Boolean(fixturePresent) && !githubActions && mode !== 'skip';
}

export function assertPrivateFixtureModeContract({
  mode,
  githubActions,
  fixturePresent,
  authenticatedProjectEnabled,
}) {
  if (!githubActions && mode !== 'required' && mode !== 'skip') {
    throw new Error(PRIVATE_FIXTURE_MODE_MESSAGE);
  }

  const enabled = privateReleaseJourneysEnabled({ mode, githubActions, fixturePresent });
  if (mode === 'required' && !enabled) throw new Error(PRIVATE_FIXTURE_REQUIRED_MESSAGE);
  if (mode === 'required' && !authenticatedProjectEnabled) throw new Error(PRIVATE_FIXTURE_AUTH_MESSAGE);
  return enabled;
}
