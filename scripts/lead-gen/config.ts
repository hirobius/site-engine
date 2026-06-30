/**
 * Lead-puller configuration — exterior-cleaning beachhead, WA+OR core metros.
 *
 * This is platform-agnostic lead sourcing: it feeds your canonical lead store,
 * which renders via the Astro factory (the contract is render-agnostic). Widen
 * METROS or KEYWORDS to grow the net; each (metro × keyword) is one Places query.
 */

/** Exterior-cleaning search terms. Overlap is fine — results dedupe by place id. */
export const KEYWORDS = [
  "pressure washing",
  "power washing",
  "soft washing",
  "roof cleaning",
  "moss removal",
  "gutter cleaning",
  "exterior house cleaning",
] as const;

/**
 * Metros + their suburbs. Google text search returns ~60 results per query, so
 * listing suburbs (not just the core city) is how you get past that ceiling and
 * actually cover a metro.
 */
export const METROS: { region: string; areas: string[] }[] = [
  {
    region: "Seattle, WA",
    areas: [
      "Seattle, WA", "Bellevue, WA", "Redmond, WA", "Kirkland, WA", "Renton, WA",
      "Everett, WA", "Kent, WA", "Federal Way, WA", "Shoreline, WA", "Bothell, WA",
    ],
  },
  {
    region: "Tacoma, WA",
    areas: ["Tacoma, WA", "Lakewood, WA", "Puyallup, WA", "University Place, WA"],
  },
  { region: "Spokane, WA", areas: ["Spokane, WA", "Spokane Valley, WA"] },
  { region: "Vancouver, WA", areas: ["Vancouver, WA", "Camas, WA"] },
  { region: "Olympia, WA", areas: ["Olympia, WA", "Lacey, WA"] },
  { region: "Bellingham, WA", areas: ["Bellingham, WA"] },
  {
    region: "Portland, OR",
    areas: [
      "Portland, OR", "Beaverton, OR", "Hillsboro, OR", "Gresham, OR",
      "Tigard, OR", "Lake Oswego, OR", "Oregon City, OR", "Milwaukie, OR",
    ],
  },
  { region: "Salem, OR", areas: ["Salem, OR", "Keizer, OR"] },
  { region: "Eugene, OR", areas: ["Eugene, OR", "Springfield, OR"] },
  { region: "Bend, OR", areas: ["Bend, OR", "Redmond, OR"] },
  { region: "Medford, OR", areas: ["Medford, OR", "Ashland, OR"] },
];

/** Which bad-site signals make a business "qualified" (worth a spec). */
export const QUALIFYING_SIGNALS = [
  "no_website",
  "site_down",
  "no_https",
  "not_mobile",
  "parked",
  "no_contact",
] as const;

export type QualifyingSignal = (typeof QUALIFYING_SIGNALS)[number];

/** Flat list of every text query (metro area × keyword). */
export function buildQueries(): { textQuery: string; region: string; area: string; keyword: string }[] {
  const queries: { textQuery: string; region: string; area: string; keyword: string }[] = [];
  for (const metro of METROS) {
    for (const area of metro.areas) {
      for (const keyword of KEYWORDS) {
        queries.push({ textQuery: `${keyword} in ${area}`, region: metro.region, area, keyword });
      }
    }
  }
  return queries;
}
