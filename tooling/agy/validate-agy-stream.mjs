import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const READ_TOOLS = new Set(['view_file', 'list_dir', 'code_search', 'grep_search']);
const WRITE_TOOLS = new Set(['write_to_file', 'replace_file_content', 'multi_replace_file_content', 'sed_file']);

function isAbsoluteWindowsPath(p) {
  if (!p || typeof p !== 'string' || p.includes('\0')) return false;
  return /^[a-zA-Z]:[\\/]/.test(p) || /^\\\\/.test(p);
}

function normalizePathForCompare(p) {
  if (!isAbsoluteWindowsPath(p)) return '';
  return path.win32.normalize(p).toLowerCase().replace(/\\/g, '/');
}

function isPathAllowed(targetPath, allowedRoots) {
  if (!isAbsoluteWindowsPath(targetPath)) {
    return false;
  }
  const normTarget = normalizePathForCompare(targetPath);
  if (!normTarget) return false;

  for (const root of allowedRoots) {
    if (!isAbsoluteWindowsPath(root)) continue;
    const normRoot = normalizePathForCompare(root);
    if (!normRoot) continue;

    if (normTarget === normRoot) {
      return true;
    }
    const rootWithSep = normRoot.endsWith('/') ? normRoot : normRoot + '/';
    if (normTarget.startsWith(rootWithSep)) {
      return true;
    }
  }
  return false;
}

function isPathDenied(targetPath, deniedRoots) {
  if (!isAbsoluteWindowsPath(targetPath) || !Array.isArray(deniedRoots) || deniedRoots.length === 0) {
    return false;
  }
  const normTarget = normalizePathForCompare(targetPath);
  if (!normTarget) return false;

  for (const root of deniedRoots) {
    if (!isAbsoluteWindowsPath(root)) continue;
    const normRoot = normalizePathForCompare(root);
    if (!normRoot) continue;

    if (normTarget === normRoot) {
      return true;
    }
    const rootWithSep = normRoot.endsWith('/') ? normRoot : normRoot + '/';
    if (normTarget.startsWith(rootWithSep)) {
      return true;
    }
  }
  return false;
}

function extractToolPath(toolName, params) {
  if (!params || typeof params !== 'object') return null;
  switch (toolName) {
    case 'view_file':
      return params.AbsolutePath || null;
    case 'list_dir':
      return params.DirectoryPath || null;
    case 'code_search':
    case 'grep_search':
      return params.SearchPath || params.DirectoryPath || null;
    case 'write_to_file':
      return params.TargetFile || null;
    case 'replace_file_content':
    case 'multi_replace_file_content':
    case 'sed_file':
      return params.TargetFile || params.AbsolutePath || null;
    default:
      return null;
  }
}

export function validateAgyStream({
  streamPath,
  stderrPath,
  nativeExitCode,
  expectedModel,
  expectedCwd,
  allowedCommands = [],
  allowedReadRoots = [],
  allowedWriteRoots = [],
  deniedReadRoots = [],
  deniedWriteRoots = [],
  expectedStatus = 'SUCCESS'
}) {
  const reasonCodes = new Set();
  const observedCommands = [];
  const observedToolNames = new Set();
  let observedToolCount = 0;
  let conversationId = null;
  let observedModel = null;
  let observedCwd = null;
  let terminalStatus = null;
  let durationSeconds = null;
  let tokenUsage = null;

  if (!expectedModel || typeof expectedModel !== 'string' || expectedModel.trim() === '') {
    reasonCodes.add('INIT_MODEL_MISMATCH');
  }

  if (Array.isArray(deniedReadRoots)) {
    for (const r of deniedReadRoots) {
      if (!isAbsoluteWindowsPath(r)) {
        reasonCodes.add('READ_PATH_DENIED');
      }
    }
  }

  if (Array.isArray(deniedWriteRoots)) {
    for (const w of deniedWriteRoots) {
      if (!isAbsoluteWindowsPath(w)) {
        reasonCodes.add('WRITE_PATH_DENIED');
      }
    }
  }

  // 1. Native Exit Code check (R2-4)
  if (nativeExitCode === undefined || nativeExitCode === null || String(nativeExitCode).trim() === '') {
    reasonCodes.add('NATIVE_EXIT_CODE_MISSING');
  } else {
    const parsedExit = Number(nativeExitCode);
    if (!Number.isInteger(parsedExit)) {
      reasonCodes.add('NATIVE_EXIT_CODE_INVALID');
    } else if (parsedExit !== 0) {
      reasonCodes.add('NONZERO_EXIT_CODE');
    }
  }

  // 2. Stderr check (R2-5)
  if (!stderrPath || typeof stderrPath !== 'string' || stderrPath.trim() === '' || !fs.existsSync(stderrPath)) {
    reasonCodes.add('STDERR_MISSING');
  } else {
    try {
      const stderrContent = fs.readFileSync(stderrPath, 'utf8');
      if (stderrContent.trim().length > 0) {
        const anomalyRegex = /permission denied|auto-deni|auto-deny|denied by policy|timeout|cancelled|cancellation|exception|traceback|fatal error|no output produced/i;
        if (anomalyRegex.test(stderrContent)) {
          reasonCodes.add('STDERR_ANOMALY');
        }
      }
    } catch {
      reasonCodes.add('STDERR_MISSING');
    }
  }

  // 3. Stream File Reading & Line Parsing
  if (!streamPath || typeof streamPath !== 'string' || streamPath.trim() === '' || !fs.existsSync(streamPath)) {
    reasonCodes.add('MALFORMED_JSON');
    return {
      status: 'RED',
      reason_codes: Array.from(reasonCodes)
    };
  }

  let rawContent;
  try {
    rawContent = fs.readFileSync(streamPath, 'utf8');
  } catch {
    reasonCodes.add('MALFORMED_JSON');
    return {
      status: 'RED',
      reason_codes: Array.from(reasonCodes)
    };
  }

  const rawLines = rawContent.split(/\r?\n/);
  const nonBlankLines = rawLines.filter(line => line.trim().length > 0);

  if (nonBlankLines.length === 0) {
    reasonCodes.add('MALFORMED_JSON');
    return {
      status: 'RED',
      reason_codes: Array.from(reasonCodes)
    };
  }

  const events = [];
  for (const line of nonBlankLines) {
    try {
      events.push(JSON.parse(line));
    } catch {
      reasonCodes.add('MALFORMED_JSON');
    }
  }

  if (events.length === 0) {
    return {
      status: 'RED',
      reason_codes: Array.from(reasonCodes)
    };
  }

  // Check allowedReadRoots
  if (!Array.isArray(allowedReadRoots) || allowedReadRoots.length === 0) {
    reasonCodes.add('READ_PATH_OUTSIDE_SCOPE');
  } else {
    for (const r of allowedReadRoots) {
      if (!isAbsoluteWindowsPath(r)) {
        reasonCodes.add('READ_PATH_OUTSIDE_SCOPE');
      }
    }
  }

  if (Array.isArray(allowedWriteRoots)) {
    for (const w of allowedWriteRoots) {
      if (!isAbsoluteWindowsPath(w)) {
        reasonCodes.add('WRITE_PATH_OUTSIDE_SCOPE');
      }
    }
  }

  // 4. Init Event Validation
  const initEvents = [];
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev && ev.event === 'init') {
      initEvents.push({ event: ev, index: i });
    }
  }

  if (initEvents.length !== 1 || initEvents[0].index !== 0) {
    reasonCodes.add('INIT_EVENT_MISSING_OR_INVALID');
  } else {
    const initEv = initEvents[0].event;
    const initData = initEv.init || {};

    const initConvId = initEv.conversation_id || initData.conversation_id;
    if (!initConvId || typeof initConvId !== 'string' || initConvId.trim() === '') {
      reasonCodes.add('CONVERSATION_ID_MISSING');
    } else {
      conversationId = initConvId;
    }

    observedModel = initData.model || null;
    observedCwd = initData.cwd || null;
    const permMode = initData.permission_mode || null;

    if (!observedModel || !expectedModel || typeof expectedModel !== 'string' || expectedModel.trim() === '' || observedModel !== expectedModel) {
      reasonCodes.add('INIT_MODEL_MISMATCH');
    }

    if (expectedCwd && !isAbsoluteWindowsPath(expectedCwd)) {
      reasonCodes.add('INIT_CWD_MISMATCH');
    }

    if (!observedCwd || !isAbsoluteWindowsPath(observedCwd) || (expectedCwd && normalizePathForCompare(observedCwd) !== normalizePathForCompare(expectedCwd))) {
      reasonCodes.add('INIT_CWD_MISMATCH');
    }

    if (permMode !== 'request-review') {
      reasonCodes.add('INIT_PERMISSION_MODE_INVALID');
    }
  }

  // 5. Terminal Result Validation
  const resultEvents = [];
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev && ev.event === 'result') {
      resultEvents.push({ event: ev, index: i });
    }
  }

  if (resultEvents.length !== 1 || resultEvents[0].index !== events.length - 1) {
    reasonCodes.add('TERMINAL_RESULT_INVALID');
  } else {
    const resEv = resultEvents[0].event;
    const resData = resEv.result || {};

    const resConvId = resData.conversation_id || resEv.conversation_id;
    if (!resConvId || typeof resConvId !== 'string' || resConvId.trim() === '') {
      reasonCodes.add('CONVERSATION_ID_MISSING');
    } else if (conversationId && resConvId !== conversationId) {
      reasonCodes.add('CONVERSATION_ID_MISMATCH');
    }

    terminalStatus = resData.status || null;
    const responseText = resData.response || '';
    durationSeconds = resData.duration_seconds !== undefined ? resData.duration_seconds : null;
    tokenUsage = resData.usage || null;

    if (expectedStatus && terminalStatus !== expectedStatus) {
      reasonCodes.add('TERMINAL_STATUS_MISMATCH');
    }

    if (typeof responseText !== 'string' || responseText.trim().length === 0) {
      reasonCodes.add('TERMINAL_RESPONSE_EMPTY');
    }
  }

  // 6. Tool Lifecycle and Security Scope Validation
  const openToolSteps = new Map();
  const allowedCmdSet = new Set(allowedCommands);
  let hasWriteTools = false;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (!ev || typeof ev !== 'object') continue;

    const su = ev.step_update;
    const hasToolAttr = !!(
      ev.tool_name || ev.tool_info || ev.tool ||
      (su && (su.tool_name || su.tool_info || su.tool))
    );

    if (ev.event !== 'step_update') {
      if (hasToolAttr) {
        reasonCodes.add('INVALID_TOOL_LIFECYCLE');
      }
      continue;
    }

    if (!su || typeof su !== 'object') {
      if (hasToolAttr) {
        reasonCodes.add('INVALID_TOOL_LIFECYCLE');
      }
      continue;
    }

    if (su.step_type !== 'tool') {
      if (hasToolAttr || su.tool_name || su.tool_info || su.tool) {
        reasonCodes.add('INVALID_TOOL_LIFECYCLE');
      }
      continue;
    }

    const stepConvId = ev.conversation_id || su.conversation_id;
    if (!stepConvId || typeof stepConvId !== 'string' || stepConvId.trim() === '') {
      reasonCodes.add('CONVERSATION_ID_MISSING');
    } else if (conversationId && stepConvId !== conversationId) {
      reasonCodes.add('CONVERSATION_ID_MISMATCH');
    }

    const stepIdx = su.step_index;
    const state = su.state;
    const toolName = su.tool_name;
    const toolInfo = su.tool_info || {};
    const params = toolInfo.parameters || {};

    if (!Number.isInteger(stepIdx) || !toolName || typeof toolName !== 'string' || toolName.trim() === '' || (state !== 'ACTIVE' && state !== 'DONE' && state !== 'ERROR')) {
      reasonCodes.add('INVALID_TOOL_LIFECYCLE');
    }

    if (state === 'ACTIVE') {
      if (openToolSteps.has(stepIdx)) {
        reasonCodes.add('INVALID_TOOL_LIFECYCLE');
      } else {
        const pathParam = extractToolPath(toolName, params);
        const cmdParam = toolName === 'run_command' ? (params.CommandLine || (typeof params === 'string' ? params : '')) : null;

        openToolSteps.set(stepIdx, {
          tool_name: toolName,
          state: 'ACTIVE',
          path: pathParam,
          cmd: cmdParam
        });
        observedToolCount++;

        if (READ_TOOLS.has(toolName)) {
          observedToolNames.add(toolName);
          if (isPathDenied(pathParam, deniedReadRoots)) {
            reasonCodes.add('READ_PATH_DENIED');
          } else if (!isPathAllowed(pathParam, allowedReadRoots)) {
            reasonCodes.add('READ_PATH_OUTSIDE_SCOPE');
          }
        } else if (WRITE_TOOLS.has(toolName)) {
          observedToolNames.add(toolName);
          hasWriteTools = true;
          if (isPathDenied(pathParam, deniedWriteRoots)) {
            reasonCodes.add('WRITE_PATH_DENIED');
          } else if (!isPathAllowed(pathParam, allowedWriteRoots)) {
            reasonCodes.add('WRITE_PATH_OUTSIDE_SCOPE');
          }
        } else if (toolName === 'run_command') {
          observedToolNames.add(toolName);
          if (cmdParam) {
            observedCommands.push(cmdParam);
            if (!allowedCmdSet.has(cmdParam)) {
              reasonCodes.add('UNAPPROVED_COMMAND');
            }
          } else {
            reasonCodes.add('UNAPPROVED_COMMAND');
          }
        } else if (toolName === 'list_permissions') {
          observedToolNames.add(toolName);
          if (params && typeof params === 'object' && Object.keys(params).length > 0) {
            reasonCodes.add('FORBIDDEN_OR_UNKNOWN_TOOL');
          }
        } else {
          reasonCodes.add('FORBIDDEN_OR_UNKNOWN_TOOL');
        }
      }
    } else if (state === 'DONE' || state === 'ERROR') {
      if (!openToolSteps.has(stepIdx)) {
        reasonCodes.add('INVALID_TOOL_LIFECYCLE');
      } else {
        const existing = openToolSteps.get(stepIdx);
        if (existing.state !== 'ACTIVE') {
          reasonCodes.add('INVALID_TOOL_LIFECYCLE');
        }
        if (existing.tool_name !== toolName) {
          reasonCodes.add('INVALID_TOOL_LIFECYCLE');
        }

        if (READ_TOOLS.has(toolName) || WRITE_TOOLS.has(toolName)) {
          const pathParam = extractToolPath(toolName, params);
          if (existing.path !== pathParam) {
            reasonCodes.add('INVALID_TOOL_LIFECYCLE');
          }
        } else if (toolName === 'run_command') {
          const cmdParam = params.CommandLine || (typeof params === 'string' ? params : '');
          if (existing.cmd !== cmdParam) {
            reasonCodes.add('INVALID_TOOL_LIFECYCLE');
          }
        } else if (toolName === 'list_permissions') {
          if (params && typeof params === 'object' && Object.keys(params).length > 0) {
            reasonCodes.add('INVALID_TOOL_LIFECYCLE');
          }
        }

        existing.state = state;
        if (state === 'ERROR') {
          reasonCodes.add('TOOL_ERROR');
        }
      }
    }
  }

  // Require at least one allowed write root when stream contains any write tool
  if (hasWriteTools && (!Array.isArray(allowedWriteRoots) || allowedWriteRoots.length === 0)) {
    reasonCodes.add('WRITE_PATH_OUTSIDE_SCOPE');
  }

  // Check for ACTIVE tools at EOF
  for (const [, entry] of openToolSteps) {
    if (entry.state === 'ACTIVE') {
      reasonCodes.add('TOOL_ACTIVE_AT_EOF');
    }
  }

  // Assemble verdict
  if (reasonCodes.size > 0) {
    return {
      status: 'RED',
      reason_codes: Array.from(reasonCodes)
    };
  }

  return {
    status: 'GREEN',
    reason_codes: [],
    conversation_id: conversationId,
    model: observedModel,
    cwd: observedCwd,
    native_exit_code: Number(nativeExitCode),
    terminal_status: terminalStatus,
    observed_tool_count: observedToolCount,
    observed_tool_names: Array.from(observedToolNames),
    observed_exact_commands: observedCommands,
    duration_seconds: durationSeconds,
    token_usage: tokenUsage
  };
}

// CLI execution handling (R2-5 & R3-9)
const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFilePath)) {
  const args = process.argv.slice(2);
  const singletons = new Map();
  const allowedCommands = [];
  const allowedReadRoots = [];
  const allowedWriteRoots = [];
  const deniedReadRoots = [];
  const deniedWriteRoots = [];
  let cliError = false;
  let overrideReasonCode = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--stream' || arg === '--stderr' || arg === '--exit-code' || arg === '--expected-model' || arg === '--expected-cwd' || arg === '--expected-status') {
      if (singletons.has(arg)) {
        cliError = true;
        break;
      }
      if (i + 1 >= args.length) {
        cliError = true;
        break;
      }
      const val = args[++i];
      if (!val || val.trim() === '' || val.startsWith('--')) {
        cliError = true;
        break;
      }
      singletons.set(arg, val);
    } else if (arg === '--allowed-command' || arg === '--allowed-read-root' || arg === '--allowed-write-root' || arg === '--denied-read-root' || arg === '--denied-write-root') {
      if (i + 1 >= args.length) {
        cliError = true;
        break;
      }
      const val = args[++i];
      if (!val || val.trim() === '' || val.startsWith('--')) {
        cliError = true;
        break;
      }
      if (arg === '--allowed-command') allowedCommands.push(val);
      else if (arg === '--allowed-read-root') allowedReadRoots.push(val);
      else if (arg === '--allowed-write-root') allowedWriteRoots.push(val);
      else if (arg === '--denied-read-root') deniedReadRoots.push(val);
      else if (arg === '--denied-write-root') deniedWriteRoots.push(val);
    } else {
      cliError = true;
      break;
    }
  }

  // Require singletons: --stream, --stderr, --exit-code, --expected-model, --expected-cwd
  if (!singletons.has('--stream') || !singletons.has('--stderr') || !singletons.has('--exit-code') || !singletons.has('--expected-model') || !singletons.has('--expected-cwd')) {
    cliError = true;
  }

  // Require at least one --allowed-read-root
  if (allowedReadRoots.length === 0) {
    cliError = true;
  }

  // Require at least one --denied-read-root and at least one --denied-write-root
  if (deniedReadRoots.length === 0 || deniedWriteRoots.length === 0) {
    cliError = true;
  }

  const expCwd = singletons.get('--expected-cwd');
  if (expCwd && !isAbsoluteWindowsPath(expCwd)) {
    cliError = true;
    overrideReasonCode = 'INIT_CWD_MISMATCH';
  }
  for (const r of allowedReadRoots) {
    if (!isAbsoluteWindowsPath(r)) {
      cliError = true;
      overrideReasonCode = 'READ_PATH_OUTSIDE_SCOPE';
      break;
    }
  }
  for (const w of allowedWriteRoots) {
    if (!isAbsoluteWindowsPath(w)) {
      cliError = true;
      overrideReasonCode = 'WRITE_PATH_OUTSIDE_SCOPE';
      break;
    }
  }
  for (const dr of deniedReadRoots) {
    if (!isAbsoluteWindowsPath(dr)) {
      cliError = true;
      overrideReasonCode = 'READ_PATH_DENIED';
      break;
    }
  }
  for (const dw of deniedWriteRoots) {
    if (!isAbsoluteWindowsPath(dw)) {
      cliError = true;
      overrideReasonCode = 'WRITE_PATH_DENIED';
      break;
    }
  }

  if (cliError) {
    const reason = overrideReasonCode || 'CLI_ARGUMENT_INVALID';
    process.stdout.write(JSON.stringify({ status: 'RED', reason_codes: [reason] }) + '\n');
    process.exit(1);
  }

  const options = {
    streamPath: singletons.get('--stream'),
    stderrPath: singletons.get('--stderr'),
    nativeExitCode: singletons.get('--exit-code'),
    expectedModel: singletons.get('--expected-model'),
    expectedCwd: singletons.get('--expected-cwd'),
    expectedStatus: singletons.get('--expected-status') || 'SUCCESS',
    allowedCommands,
    allowedReadRoots,
    allowedWriteRoots,
    deniedReadRoots,
    deniedWriteRoots
  };

  const verdict = validateAgyStream(options);
  process.stdout.write(JSON.stringify(verdict) + '\n');
  process.exit(verdict.status === 'GREEN' ? 0 : 1);
}
