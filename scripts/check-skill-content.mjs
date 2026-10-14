#!/usr/bin/env node
/**
 * check-skill-content — scans every installed skill (.claude/skills/**) for
 * text that should never ship in a skill:
 *
 *   PIPE_TO_SHELL     curl/wget/iwr … | sh|bash|iex — runs remote code unseen
 *   EXFILTRATION      a secret, process.env or ~/.ssh sent over the network, or a
 *                     known capture host (webhook.site, requestbin, ngrok, …)
 *   PROMPT_INJECTION  "ignore previous instructions", "disregard the system
 *                     prompt", "don't tell the user"
 *   HIDDEN_UNICODE    bidi overrides or zero-width characters that hide text
 *
 * skills-lock.json proves a skill's text did not change since it was pinned;
 * this proves the pinned text is not hostile. A reviewed false positive (a
 * security skill quoting the pattern it warns against) goes in
 * docs/guardrails/skill-content-allowlist.json with the exact matched text and
 * a reason; an entry whose text no longer appears is reported so it can't hide
 * a later change.
 *
 *   node scripts/check-skill-content.mjs           exit 1 on any finding
 *   node scripts/check-skill-content.mjs --json    machine output
 *
 * Shared fleet script: ops is canonical; hds and clients keep a byte-identical copy.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Fixture mode (proof-of-firing): FIXTURE_DIR is a mini-root holding .claude/skills/.
const FIXTURE_DIR =
  process.argv.includes('--fixture-mode') || process.env.HDS_FIXTURE_MODE === '1'
    ? process.env.FIXTURE_DIR
    : undefined;
const ROOT = FIXTURE_DIR
  ? resolve(FIXTURE_DIR)
  : resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = join(ROOT, '.claude/skills');
const ALLOWLIST = join(ROOT, 'docs/guardrails/skill-content-allowlist.json');
const TEXT_EXT = new Set([
  '',
  '.md',
  '.mdx',
  '.txt',
  '.json',
  '.yml',
  '.yaml',
  '.sh',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.py',
]);
const SECRETISH = String.raw`(?:\$\{?\w*(?:TOKEN|SECRET|PASSWORD|API_?KEY|PRIVATE_?KEY)\w*\}?|process\.env\b(?!\.\w)|~\/\.ssh|id_rsa|\.aws\/credentials|\.npmrc|\.env\b)`;

/** @type {Array<{ rule: string, re: RegExp }>} */
const RULES = [
  {
    rule: 'PIPE_TO_SHELL',
    re: /\b(?:curl|wget|iwr|Invoke-WebRequest)\b[^\n|]*\|\s*(?:sudo\s+)?(?:sh|bash|zsh|iex|Invoke-Expression)\b/gi,
  },
  {
    rule: 'EXFILTRATION',
    re: new RegExp(
      String.raw`\b(?:curl|wget|fetch|axios|Invoke-WebRequest|requests\.(?:post|put))\b[^\n]*${SECRETISH}` +
        String.raw`|\bfetch\([^\n]*JSON\.stringify\(process\.env\)` +
        String.raw`|\b(?:webhook\.site|requestbin\.\w+|pipedream\.net|ngrok\.io|ngrok-free\.app|burpcollaborator\.net|interact\.sh|oast\.(?:fun|me|pro|live|site|online))\b`,
      'gi',
    ),
  },
  {
    rule: 'PROMPT_INJECTION',
    re: /\bignore (?:all |any )?(?:the )?(?:previous|prior|above|earlier) (?:instructions|prompts|rules)\b|\bdisregard (?:the |your |all )?(?:system prompt|previous instructions|instructions)\b|\b(?:do not|don't|never) (?:tell|inform|reveal (?:this |it )?to|mention (?:this |it )?to) the user\b/gi,
  },
  { rule: 'HIDDEN_UNICODE', re: /[​-‏‪-‮⁦-⁩]/g },
];

/**
 * @param {string} text
 * @param {string} file repo-relative path, for the report
 * @returns {Array<{ file: string, line: number, rule: string, match: string }>}
 */
export function scanText(text, file) {
  const findings = [];
  const lines = text.split('\n');
  lines.forEach((lineText, i) => {
    for (const { rule, re } of RULES) {
      re.lastIndex = 0;
      const m = re.exec(lineText);
      if (m) findings.push({ file, line: i + 1, rule, match: m[0].slice(0, 200) });
    }
  });
  return findings;
}

/**
 * @param {ReturnType<typeof scanText>} findings
 * @param {Array<{ file: string, rule: string, match: string, reason: string }>} allow
 */
export function applyAllowlist(findings, allow) {
  const key = (x) => `${x.file}\u0000${x.rule}\u0000${x.match}`;
  const allowed = new Set(allow.map(key));
  const seen = new Set(findings.map(key));
  return {
    kept: findings.filter((f) => !allowed.has(key(f))),
    stale: allow.filter((a) => !seen.has(key(a))),
  };
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (TEXT_EXT.has(extname(name)) && st.size < 2_000_000) out.push(p);
  }
  return out;
}

function main() {
  const json = process.argv.includes('--json');
  if (!existsSync(SKILLS_DIR)) {
    console.log('✓ check-skill-content: no .claude/skills directory');
    return;
  }
  const findings = walk(SKILLS_DIR).flatMap((p) =>
    scanText(readFileSync(p, 'utf8'), relative(ROOT, p)),
  );
  const allow = existsSync(ALLOWLIST) ? JSON.parse(readFileSync(ALLOWLIST, 'utf8')).entries : [];
  const { kept, stale } = applyAllowlist(findings, allow);
  if (json) {
    console.log(
      JSON.stringify({ ok: kept.length === 0 && stale.length === 0, findings: kept, stale }),
    );
  } else {
    for (const f of kept) console.error(`✗ ${f.file}:${f.line} ${f.rule}: ${f.match}`);
    for (const s of stale)
      console.error(
        `✗ allowlist entry no longer matches (remove it): ${s.file} ${s.rule}: ${s.match}`,
      );
    if (kept.length || stale.length) {
      console.error(
        '\ncheck-skill-content: review each line above. A hostile skill: remove or re-pin it. ' +
          'A reviewed false positive: add it to docs/guardrails/skill-content-allowlist.json with a reason.',
      );
    } else {
      console.log(`✓ check-skill-content: ${findings.length - kept.length} reviewed, 0 open`);
    }
  }
  if (kept.length || stale.length) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
