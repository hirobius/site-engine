#!/usr/bin/env node
// Vendored copy of hirobius/ops scripts/hooks/agent-event.mjs (tests live there). Keep identical.
/**
 * scripts/hooks/agent-event.mjs — reports Claude session milestones to
 * /ops/standing (ops#585, #590). Wired as a Claude Code hook on SessionStart,
 * UserPromptSubmit, Notification, Stop and SessionEnd in each fleet repo's
 * .claude/settings.json.
 *
 * Fail-silent by design: a missing env var, a slow network or a 4xx never
 * blocks or breaks the session. It exits 0 every time.
 *
 * Env (set once in the cloud environment, never committed):
 *   OPS_EVENTS_URL  base URL of the ops deployment, e.g. https://ops.hirobius.com
 *   OPS_AGENT_KEY   the same value as OPS_AGENT_KEY in Vercel (machine login)
 */

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const TIMEOUT_MS = 3000;

/** @type {Record<string, { event: string, note?: string }>} */
const MAP = {
  SessionStart: { event: 'session_started' },
  UserPromptSubmit: { event: 'session_started' },
  Notification: { event: 'waiting' },
  Stop: { event: 'session_done', note: 'Finished its turn' },
  SessionEnd: { event: 'session_done', note: 'Session ended' },
};

/**
 * @param {Record<string, any>} input  the hook's stdin JSON
 * @param {Record<string, string|undefined>} env
 * @param {{ repo: string, branch: string }} git
 */
export function buildPayload(input, env, git) {
  const m = MAP[input?.hook_event_name];
  if (!m) return null;
  const cloud = env.CLAUDE_CODE_REMOTE_SESSION_ID;
  const sessionId = cloud
    ? cloud.replace(/^cse_/, 'session_')
    : String(input.session_id || 'unknown');
  /** @type {{ sessionId: string, event: string, title: string, repo?: string, url?: string, note?: string }} */
  const payload = { sessionId, event: m.event, title: git.branch || 'Claude session' };
  if (git.repo) payload.repo = git.repo;
  if (cloud) payload.url = `https://claude.ai/code/${sessionId}`;
  const note = m.event === 'waiting' ? input.message : m.note;
  if (note) payload.note = String(note);
  return payload;
}

/**
 * @param {object} payload
 * @param {Record<string, string|undefined>} env
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<'sent'|'skipped'|'failed'>}
 */
export async function sendEvent(payload, env, fetchImpl = fetch) {
  const base = env.OPS_EVENTS_URL;
  const key = env.OPS_AGENT_KEY;
  if (!base || !key) return 'skipped';
  try {
    const res = await fetchImpl(`${base.replace(/\/+$/, '')}/api/agent-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}

function gitInfo() {
  const run = (args) => {
    try {
      return execFileSync('git', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      return '';
    }
  };
  const remote = run(['remote', 'get-url', 'origin']);
  const repo = (/github\.com[/:]([^/]+\/[^/.]+)/.exec(remote) || [])[1] || '';
  return { repo, branch: run(['branch', '--show-current']) };
}

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  try {
    return JSON.parse(data || '{}');
  } catch {
    return {};
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const payload = buildPayload(await readStdin(), process.env, gitInfo());
    if (payload) await sendEvent(payload, process.env);
  } catch {
    // never break a session
  }
  process.exit(0);
}
