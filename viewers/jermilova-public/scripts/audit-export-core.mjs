import { createHash } from 'node:crypto';
import ts from 'typescript';

// Ported from the R16 derived audit core (reviewed GREEN). Changes: bare
// 'typescript' import, and this marker list for the faithful (original-component)
// viewer:
// - Retired 'esri', 'opentopomap', 'stamen': the owner kept the original basemaps.
// - Retired legacy-model ids ('bnrrm-landis-causal', 'sed_cu', 'sulfide_binding',
//   'tox_amphipod') and 'wms-identify': the original stores/libraries embed them as
//   source. "Only Jermilova renders" is enforced by behavior instead (fallback deleted
//   in the shell fork; parity tests), and every server path stays caught by the
//   '/api/' rule below.
// - Added write/export fingerprints that the forks delete: the persisted-store key,
//   the results/map/site export filenames, and the map image exporter.
export const FORBIDDEN_MARKERS = [
  'supabase',
  'document_reviews',
  'jermilova-review',
  'sstac-bn-rrm-site-data',
  'bn-rrm-results-',
  'openpra-map-',
  'bn-rrm-multi-site-',
  'bn-rrm-identified-features-',
  'html-to-image',
  // Bundle-level proof that the exact-module aliases swapped in the forks: these
  // survive minification (object keys / string literals) only in the originals.
  'loadTrainedModel',
  'loadDummyModel',
  'Benthic Risk Conceptual Model',
];

export const NEXT_API_ROUTE_SOURCE_PINS = [
  {
    path: 'node_modules/next/dist/lib/is-api-route.js',
    kind: 'cjs',
    bytes: 373,
    sha256: '9a239610ccb575a8223f8dffcd2d6e518d1e3a87a503911b88222a1df0d063ef',
  },
  {
    path: 'node_modules/next/dist/esm/lib/is-api-route.js',
    kind: 'esm',
    bytes: 171,
    sha256: '362edd7fb36dbd1331820ba08e29a955cd476f9fb1ec5a1bb2de9cdee8967436',
  },
];

function parseJavaScript(text, fileName) {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  if (source.parseDiagnostics.length) return null;
  return source;
}

function unwrap(node) {
  while (ts.isParenthesizedExpression(node)) node = node.expression;
  return node;
}

function identifier(node, name) {
  return ts.isIdentifier(node) && node.text === name;
}

function stringValue(node) {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : null;
}

function hasApiRouteSemantics(fn) {
  const body = fn.body;
  if (!body || !ts.isBlock(body) || body.statements.length !== 1 || !ts.isReturnStatement(body.statements[0])) return false;
  const expr = unwrap(body.statements[0].expression);
  if (!expr || !ts.isBinaryExpression(expr) || expr.operatorToken.kind !== ts.SyntaxKind.BarBarToken) return false;
  const parameter = fn.parameters[0]?.name;
  if (!parameter || !ts.isIdentifier(parameter) || fn.parameters.length !== 1) return false;
  const left = unwrap(expr.left);
  const equality = ts.isBinaryExpression(left) && left.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken;
  const equalityOk = equality && (
    (identifier(unwrap(left.left), parameter.text) && stringValue(unwrap(left.right)) === '/api')
    || (stringValue(unwrap(left.left)) === '/api' && identifier(unwrap(left.right), parameter.text))
  );
  if (!equalityOk) return false;

  let fallback = unwrap(expr.right);
  while (ts.isPrefixUnaryExpression(fallback) && fallback.operator === ts.SyntaxKind.ExclamationToken) fallback = unwrap(fallback.operand);
  if (ts.isCallExpression(fallback) && identifier(unwrap(fallback.expression), 'Boolean') && fallback.arguments.length === 1) {
    fallback = unwrap(fallback.arguments[0]);
  }
  if (!ts.isConditionalExpression(fallback)) return false;
  const condition = unwrap(fallback.condition);
  if (!ts.isBinaryExpression(condition) || condition.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsToken) return false;
  const nullGuard = (identifier(unwrap(condition.left), parameter.text) && condition.right.kind === ts.SyntaxKind.NullKeyword)
    || (condition.left.kind === ts.SyntaxKind.NullKeyword && identifier(unwrap(condition.right), parameter.text));
  if (!nullGuard) return false;
  const whenNull = unwrap(fallback.whenTrue);
  if (!ts.isVoidExpression(whenNull) || whenNull.expression.kind !== ts.SyntaxKind.NumericLiteral || whenNull.expression.text !== '0') return false;
  const call = unwrap(fallback.whenFalse);
  if (!ts.isCallExpression(call) || call.arguments.length !== 1 || stringValue(unwrap(call.arguments[0])) !== '/api/') return false;
  const receiver = unwrap(call.expression);
  return ts.isPropertyAccessExpression(receiver)
    && identifier(unwrap(receiver.expression), parameter.text)
    && receiver.name.text === 'startsWith';
}

function isFunctionLike(node) {
  return ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node);
}

function countApiSlash(text) {
  return (text.match(/\/api\//g) || []).length;
}

function hasCjsExportFor(factory, functionName) {
  let matches = 0;
  function visit(node) {
    if (ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && identifier(node.expression.expression, 'Object')
      && node.expression.name.text === 'defineProperty'
      && node.arguments.length === 3
      && ts.isIdentifier(node.arguments[0])
      && stringValue(unwrap(node.arguments[1])) === 'isAPIRoute'
      && ts.isObjectLiteralExpression(unwrap(node.arguments[2]))) {
      const descriptor = unwrap(node.arguments[2]);
      for (const property of descriptor.properties) {
        if (!ts.isPropertyAssignment(property) || property.name.getText().replaceAll('"', '') !== 'get') continue;
        const getter = unwrap(property.initializer);
        if (!isFunctionLike(getter) || !getter.body || !ts.isBlock(getter.body) || getter.body.statements.length !== 1) continue;
        const statement = getter.body.statements[0];
        if (ts.isReturnStatement(statement) && identifier(unwrap(statement.expression), functionName)) matches += 1;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(factory.body);
  return matches === 1;
}

function hasEsmExportFor(fn) {
  return !!fn.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
}

function enclosingModuleFactory(fn) {
  let current = fn.parent;
  while (current) {
    if (isFunctionLike(current)) return current;
    current = current.parent;
  }
  return null;
}

function apiRouteProofInBundle(text, fileName) {
  const source = parseJavaScript(text, fileName);
  if (!source) return false;
  if (countApiSlash(text) !== 1) return false;
  const candidates = [];
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name && hasApiRouteSemantics(node)) {
      const factory = enclosingModuleFactory(node);
      if (factory && countApiSlash(factory.getText(source)) === 1 && hasCjsExportFor(factory, node.name.text)) {
        candidates.push(node);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return candidates.length === 1;
}

export function auditBundleMarkers(files, nextApiSourcesAuthenticated, extraForbiddenMarkers = []) {
  const findings = [];
  const apiFiles = [];
  for (const file of files) {
    const text = Buffer.from(file.bytes).toString('utf8').toLowerCase();
    for (const marker of [...FORBIDDEN_MARKERS, ...extraForbiddenMarkers]) {
      if (text.includes(marker.toLowerCase())) findings.push({ file: file.relativePath, marker });
    }
    const apiCount = countApiSlash(text);
    if (apiCount) apiFiles.push({ file, apiCount });
  }
  if (apiFiles.length) {
    if (!nextApiSourcesAuthenticated) {
      findings.push({ file: '*', marker: '/api/ provenance sources not authenticated' });
    } else {
      const valid = apiFiles.length === 1
        && apiFiles[0].apiCount === 1
        && /\.(?:js|mjs)$/i.test(apiFiles[0].file.relativePath)
        && apiRouteProofInBundle(Buffer.from(apiFiles[0].file.bytes).toString('utf8'), apiFiles[0].file.relativePath);
      if (!valid) findings.push(...apiFiles.map(({ file }) => ({ file: file.relativePath, marker: '/api/ without sole pinned isAPIRoute provenance' })));
    }
  }
  return findings;
}

export function hasPinnedApiRouteSourceSemantics(text, moduleKind) {
  const source = parseJavaScript(text, moduleKind);
  if (!source || countApiSlash(text) !== 1) return false;
  let matches = [];
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'isAPIRoute' && hasApiRouteSemantics(node)) {
      if ((moduleKind === 'esm' && hasEsmExportFor(node)) || (moduleKind === 'cjs' && (() => {
        const factory = { body: source };
        return hasCjsExportFor(factory, 'isAPIRoute');
      })())) matches.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return matches.length === 1;
}

export function authenticatePinnedApiRouteSources(sources, inputFiles) {
  if (!Array.isArray(sources) || !Array.isArray(inputFiles)) {
    return { authenticated: false, results: [] };
  }
  const results = NEXT_API_ROUTE_SOURCE_PINS.map((pin) => {
    const matches = sources.filter((source) => source.path === pin.path);
    const source = matches.length === 1 ? matches[0] : null;
    const inputMatches = inputFiles.filter((file) => file.path === pin.path);
    const input = inputMatches.length === 1 ? inputMatches[0] : null;
    const bytes = source && source.bytes instanceof Uint8Array ? Buffer.from(source.bytes) : null;
    const sha256 = bytes ? createHash('sha256').update(bytes).digest('hex') : null;
    const semantics = !!source
      && source.kind === pin.kind
      && hasPinnedApiRouteSourceSemantics(bytes?.toString('utf8') ?? '', pin.kind);
    const pass = matches.length === 1
      && !!bytes
      && !!input
      && bytes.length === pin.bytes
      && sha256 === pin.sha256
      && source.kind === pin.kind
      && source.bytes_count === pin.bytes
      && source.sha256 === pin.sha256
      && input.bytes === pin.bytes
      && input.sha256 === pin.sha256
      && semantics;
    return { path: pin.path, kind: pin.kind, bytes: bytes?.length ?? 0, sha256, semantics, pass };
  });
  return { authenticated: results.length === NEXT_API_ROUTE_SOURCE_PINS.length && results.every((entry) => entry.pass), results };
}
