import type { QualifyingSignal } from "./config.js";

/**
 * Tech-detection: given a business website, decide whether it's "bad enough"
 * that a fresh spec site is an easy sell. Cheap heuristics, resilient to junk —
 * a fetch failure just means the site is down, which is itself a qualifying
 * signal.
 */

export interface SiteInspection {
  reachable: boolean;
  signals: QualifyingSignal[];
}

const PARKED_MARKERS = [
  "domain is for sale",
  "buy this domain",
  "parked by",
  "godaddy.com/domains",
  "this domain is parked",
  "future home of something",
  "under construction",
];

export async function inspectSite(websiteUri: string): Promise<SiteInspection> {
  const signals: QualifyingSignal[] = [];

  let res: Response;
  try {
    res = await fetch(websiteUri, {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (lead-qualifier)" },
    });
  } catch {
    return { reachable: false, signals: ["site_down"] };
  }

  if (!res.ok) return { reachable: false, signals: ["site_down"] };

  // Final URL after redirects — if it isn't https, flag it.
  if (!res.url.startsWith("https://")) signals.push("no_https");

  const html = (await res.text().catch(() => "")).toLowerCase();

  if (html.length < 500 || PARKED_MARKERS.some((m) => html.includes(m))) {
    signals.push("parked");
  }
  if (!html.includes("name=\"viewport\"") && !html.includes("name='viewport'")) {
    signals.push("not_mobile");
  }
  if (!html.includes("tel:") && !html.includes("mailto:") && !html.includes("<form")) {
    signals.push("no_contact");
  }

  return { reachable: true, signals };
}
