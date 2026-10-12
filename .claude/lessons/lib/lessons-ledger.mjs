/**
 * scripts/lib/lessons-ledger.mjs — the fleet lessons ledger (ops#600, ops#602).
 *
 * `docs/ai/learned-rules.jsonl` is the one place every lesson lives: one JSON
 * object per line, editable (git is the history). Row shape:
 *
 *   id           "L-0001" upward, stable
 *   kind         "failure" | "success"
 *   rule         one imperative sentence
 *   why          one sentence
 *   scope        { repos, paths, topics, commands } — arrays of strings.
 *                repos: FLEET_REPOS names, [] = every fleet repo; paths are
 *                globs; topics are prompt keywords; commands are shell patterns.
 *                Paths are checked here only for rows scoped to ops: the copy
 *                vendored into each repo checks that repo's paths (ops#610).
 *   enforcement  "none" | "review" | "inject" | "check:<registry id>"
 *   status       "candidate" | "active" | "enforced" | "obsolete"
 *                (candidates are excluded from recall until triaged, ops#608)
 *   statusReason string | null (required for obsolete: what fixed it)
 *   rootCause    one of ROOT_CAUSES | null (null until triaged)
 *   evidence     ["ops#348", "<sha>", "hds#520", ...], at least one
 *   recurrence   integer >= 1
 *   fixedBy      refs of issues that would close it (ops#609)
 *   source       where the row came from ("manual", "park-harvest", ...)
 *   firstSeen    ISO date or date-time
 *   lastSeen     ISO date or date-time, not before firstSeen
 *   reviewedAt   ISO date when someone last triaged it | null
 *
 * The gate is scripts/check-lessons-ledger.mjs.
 *
 * @module lessons-ledger
 */

export const KINDS = ['failure', 'success'];
export const STATUSES = ['candidate', 'active', 'enforced', 'obsolete'];
export const ROOT_CAUSES = [
  'missing-check',
  'wrong-home-for-state',
  'manual-step',
  'missing-access',
  'knowledge',
];
export const FLEET_REPOS = ['ops', 'hds', 'site-engine', 'folio', 'ralph', 'concrete'];

/** Every rule the gate can report, with the fix it prints. */
export const LEDGER_RULES = {
  'missing-ledger': 'Restore docs/ai/learned-rules.jsonl from git; the gate needs a ledger.',
  'bad-json': 'Make the line one JSON object, or delete it.',
  'bad-field': 'Set the field to a value the schema allows (scripts/lib/lessons-ledger.mjs).',
  'unknown-key': 'Remove the key, or add it to the schema first.',
  'duplicate-id': 'Give the newer row the next free L-xxxx id.',
  'unknown-check': 'Register the gate in docs/guardrails/registry.json, or set enforcement back.',
  'status-mismatch': 'Pair status "enforced" with enforcement "check:<registry id>".',
  'obsolete-without-reason': 'Say what fixed it in statusReason (a PR, a check, a model change).',
  'inject-without-matcher': 'Add a topic, path or command to scope, or set enforcement "none".',
  'missing-path': 'Fix the path, or drop "ops" from scope.repos if it lives in another repo.',
};

const SCOPE_KEYS = ['repos', 'paths', 'topics', 'commands'];
const ID = /^L-(\d{4,})$/;

const isText = (v) => typeof v === 'string' && v.trim() !== '';
const isTextList = (v) => Array.isArray(v) && v.every(isText);
const isDate = (v) => isText(v) && /^\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(Date.parse(v));

/**
 * `enforcement` → `{ mode, check }`: mode is "none" | "review" | "inject" | "check",
 * check is the registry id for a check (else null). Null when the value is invalid.
 */
export function parseEnforcement(value) {
  if (value === 'none' || value === 'review' || value === 'inject') {
    return { mode: value, check: null };
  }
  const m = typeof value === 'string' ? /^check:(\S+)$/.exec(value) : null;
  return m ? { mode: 'check', check: m[1] } : null;
}

/** Each field and the test its value must pass. */
const FIELDS = {
  id: (v) => typeof v === 'string' && ID.test(v),
  kind: (v) => KINDS.includes(v),
  rule: isText,
  why: isText,
  scope: (v) =>
    v !== null &&
    typeof v === 'object' &&
    Object.keys(v).length === SCOPE_KEYS.length &&
    SCOPE_KEYS.every((k) => isTextList(v[k])) &&
    v.repos.every((r) => FLEET_REPOS.includes(r)),
  enforcement: (v) => parseEnforcement(v) !== null,
  status: (v) => STATUSES.includes(v),
  statusReason: (v) => v === null || isText(v),
  rootCause: (v) => v === null || ROOT_CAUSES.includes(v),
  evidence: (v) => isTextList(v) && v.length > 0,
  recurrence: (v) => Number.isInteger(v) && v >= 1,
  fixedBy: isTextList,
  source: isText,
  firstSeen: isDate,
  lastSeen: isDate,
  reviewedAt: (v) => v === null || isDate(v),
};

/** Legacy `evidence_unit_id` ("ops#90,#240") → ["ops#90", "ops#240"]. */
function splitEvidence(raw) {
  if (!raw) return [];
  const parts = String(raw)
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const repo = parts[0]?.includes('#') ? parts[0].split('#')[0] : '';
  return parts.map((p) => (p.startsWith('#') && repo ? `${repo}${p}` : p));
}

/**
 * Turn a legacy-shaped entry (rule, rationale, source, evidence_unit_id, ts)
 * into a full ledger row. Nobody has triaged it, so reviewedAt is null.
 *
 * @param {object} entry
 * @param {string} id                the row's id, e.g. "L-0007"
 * @param {{ status?: string }} [opts] starting status (default "active")
 */
export function toLedgerRow(entry, id, { status = 'active' } = {}) {
  const evidence = splitEvidence(entry.evidence_unit_id);
  return {
    id,
    kind: 'failure',
    rule: entry.rule,
    why: entry.rationale,
    scope: { repos: [], paths: [], topics: [], commands: [] },
    enforcement: 'none',
    status,
    statusReason: null,
    rootCause: null,
    evidence,
    recurrence: Math.max(1, evidence.length),
    fixedBy: [],
    source: entry.source,
    firstSeen: entry.ts,
    lastSeen: entry.ts,
    reviewedAt: null,
  };
}

/** The directory part of a glob before its first wildcard: "scripts/check-*.mjs" → "scripts". */
function staticPrefix(glob) {
  const head = glob.split(/[*?[{(!+@]/)[0];
  if (head === glob) return glob.replace(/\/+$/, '');
  return head.includes('/') ? head.slice(0, head.lastIndexOf('/')) : '';
}

/**
 * Check a parsed ledger. Returns violations `{ id, rule, message }` (rule is a
 * LEDGER_RULES key); an empty array means the ledger is well-formed.
 *
 * @param {object[]} rows
 * @param {{ registryIds: Set<string>, pathExists: (p: string) => boolean }} ctx
 */
export function validateLedger(rows, ctx) {
  const out = [];
  const seenIds = new Set();
  for (const row of rows) {
    const flag = (rule, message) => out.push({ id: row?.id ?? null, rule, message });

    for (const [key, ok] of Object.entries(FIELDS)) {
      if (!ok(row[key])) {
        flag('bad-field', `${key} is missing or invalid: ${JSON.stringify(row[key])}`);
      }
    }
    for (const key of Object.keys(row)) {
      if (!(key in FIELDS)) flag('unknown-key', `unknown key "${key}"`);
    }
    if (FIELDS.id(row.id)) {
      if (seenIds.has(row.id)) flag('duplicate-id', `${row.id} appears more than once`);
      seenIds.add(row.id);
    }
    if (
      isDate(row.firstSeen) &&
      isDate(row.lastSeen) &&
      Date.parse(row.lastSeen) < Date.parse(row.firstSeen)
    ) {
      flag('bad-field', `lastSeen ${row.lastSeen} is before firstSeen ${row.firstSeen}`);
    }

    const enforcement = parseEnforcement(row.enforcement);
    const check = enforcement?.check ?? null;
    if (check && !ctx.registryIds.has(check)) {
      flag('unknown-check', `${check} is not a gate in docs/guardrails/registry.json`);
    }
    if (
      enforcement &&
      row.status !== 'obsolete' &&
      (row.status === 'enforced') !== Boolean(check)
    ) {
      flag(
        'status-mismatch',
        check
          ? `enforcement names ${check}, so status must be "enforced"`
          : 'status "enforced" needs enforcement "check:<registry id>"',
      );
    }
    if (row.status === 'obsolete' && !isText(row.statusReason)) {
      flag('obsolete-without-reason', 'an obsolete row must say what fixed it in statusReason');
    }

    const scope = FIELDS.scope(row.scope) ? row.scope : null;
    if (!scope) continue;
    if (
      enforcement?.mode === 'inject' &&
      !scope.topics.length &&
      !scope.paths.length &&
      !scope.commands.length
    ) {
      flag('inject-without-matcher', 'an inject row needs at least one topic, path or command');
    }
    if (scope.repos.includes('ops')) {
      for (const glob of scope.paths) {
        const prefix = staticPrefix(glob);
        if (prefix && !ctx.pathExists(prefix)) {
          flag('missing-path', `${glob}: ${prefix} does not exist`);
        }
      }
    }
  }
  return out;
}

/**
 * Parse ledger text. Blank lines are skipped; a line that is not a JSON
 * object becomes an error `{ line, message }` instead of being dropped.
 *
 * @param {string} text
 * @returns {{ rows: object[], errors: { line: number, message: string }[] }}
 */
export function parseLedger(text) {
  const rows = [];
  const errors = [];
  text.split('\n').forEach((raw, i) => {
    if (!raw.trim()) return;
    try {
      const value = JSON.parse(raw);
      if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error();
      rows.push(value);
    } catch {
      errors.push({ line: i + 1, message: `not a JSON object: ${raw.slice(0, 60)}` });
    }
  });
  return { rows, errors };
}

/** The id after the highest one in `rows`: [L-0009] → "L-0010"; [] → "L-0001". */
export function nextLessonId(rows) {
  const max = rows.reduce((m, r) => {
    const n = ID.exec(r?.id ?? '')?.[1];
    return n ? Math.max(m, Number(n)) : m;
  }, 0);
  return `L-${String(max + 1).padStart(4, '0')}`;
}

/**
 * A stable identity for a lesson: its evidence plus when it was first seen.
 * The rule text is left out, so rewording a row doesn't make a harvester re-add
 * it. Works on a ledger row or a legacy entry (evidence_unit_id + ts).
 */
export function lessonFingerprint(entryOrRow) {
  const evidence = Array.isArray(entryOrRow.evidence)
    ? entryOrRow.evidence
    : splitEvidence(entryOrRow.evidence_unit_id);
  const firstSeen = entryOrRow.firstSeen ?? entryOrRow.ts;
  return `${evidence.join(',')}|${firstSeen}`;
}
