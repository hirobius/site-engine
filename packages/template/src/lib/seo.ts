import type { ClientConfig } from "@hirobius/schema";
import { OG_IMAGE_PATH } from "./og-image.js";

/**
 * `days`/`hours` on a config's `business.hours` row are free-form display
 * strings (e.g. "Mon–Fri", "8:00 AM – 6:00 PM") — that's a UI concern, not a
 * schema one, so `packages/schema` isn't touched here (a shape change there
 * needs a cross-repo ops re-sync, see AGENTS.md § contracts). Instead this
 * parses the two known factory conventions into schema.org's structured
 * `DayOfWeek`/`opens`/`closes` for JSON-LD. Rows that don't match a known
 * pattern (e.g. "By appointment", "Closed") are silently omitted — a missing
 * day is the schema.org-correct way to say "not open then", and guessing at
 * an unparseable string would be worse than omitting it.
 */
const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_NAMES: Record<(typeof DAY_ORDER)[number], string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

/** "Mon–Fri" / "Sat" / "Mon, Wed, Fri" -> schema.org DayOfWeek URIs. */
function parseDaysOfWeek(days: string): string[] {
  const normalized = days.trim().replace(/[\u2010-\u2015]/g, "-");

  const range = normalized.match(/^([a-z]{3})\s*-\s*([a-z]{3})$/i);
  if (range) {
    const start = DAY_ORDER.indexOf(range[1]!.toLowerCase() as (typeof DAY_ORDER)[number]);
    const end = DAY_ORDER.indexOf(range[2]!.toLowerCase() as (typeof DAY_ORDER)[number]);
    if (start === -1 || end === -1 || end < start) return [];
    return DAY_ORDER.slice(start, end + 1).map((d) => `https://schema.org/${DAY_NAMES[d]}`);
  }

  const list = normalized.split(",").map((d) => d.trim().toLowerCase());
  if (list.every((d): d is (typeof DAY_ORDER)[number] => (DAY_ORDER as readonly string[]).includes(d))) {
    return list.map((d) => `https://schema.org/${DAY_NAMES[d as (typeof DAY_ORDER)[number]]}`);
  }

  return [];
}

/** "8:00 AM" -> "08:00" (24h). Returns null on anything that doesn't match. */
function parseClockTime(raw: string): string | null {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  const minute = match[2]!;
  let hour = Number(match[1]);
  if (hour < 1 || hour > 12) return null;
  const meridiem = match[3]!.toUpperCase();
  hour = meridiem === "AM" ? (hour === 12 ? 0 : hour) : hour === 12 ? 12 : hour + 12;
  return `${String(hour).padStart(2, "0")}:${minute}`;
}

/** "8:00 AM – 6:00 PM" -> 24h opens/closes. Returns null for "Closed", "By appointment", etc. */
function parseOpenClose(hours: string): { opens: string; closes: string } | null {
  const normalized = hours.trim().replace(/[\u2010-\u2015]/g, "-");
  const parts = normalized.split("-");
  if (parts.length !== 2) return null;
  const opens = parseClockTime(parts[0]!);
  const closes = parseClockTime(parts[1]!);
  if (!opens || !closes) return null;
  return { opens, closes };
}

/** Build a machine-parseable schema.org OpeningHoursSpecification list. */
export function openingHoursSpecification(
  hours: ClientConfig["business"]["hours"],
): Array<Record<string, unknown>> {
  return hours.flatMap((h) => {
    const dayOfWeek = parseDaysOfWeek(h.days);
    const clock = parseOpenClose(h.hours);
    if (dayOfWeek.length === 0 || !clock) return [];
    return [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek,
        opens: clock.opens,
        closes: clock.closes,
      },
    ];
  });
}

/**
 * Build a schema.org LocalBusiness JSON-LD object from config.
 *
 * Local SEO is the whole point of these sites, so this is generated, not
 * hand-authored per client. Emitted as a <script type="application/ld+json">
 * by BaseHead.astro.
 */
export function localBusinessJsonLd(config: ClientConfig): Record<string, unknown> {
  const { business, seo } = config;

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${seo.siteUrl}#business`,
    name: business.name,
    telephone: business.phone,
    email: business.email,
    url: seo.siteUrl,
    description: seo.description,
    areaServed: business.serviceAreas.map((name) => ({
      "@type": "City",
      name,
    })),
    address: {
      "@type": "PostalAddress",
      addressLocality: seo.city,
      addressRegion: seo.region,
      ...(business.address ? { streetAddress: business.address } : {}),
    },
    openingHoursSpecification: openingHoursSpecification(business.hours),
  };

  jsonLd.image = absoluteUrl(seo.siteUrl, seo.ogImage ?? OG_IMAGE_PATH);

  if (config.reviews.length > 0) {
    const avg =
      config.reviews.reduce((sum, r) => sum + r.rating, 0) / config.reviews.length;
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: avg.toFixed(1),
      reviewCount: config.reviews.length,
    };
  }

  return jsonLd;
}

/** Join a site origin and an absolute public path into a full URL. */
export function absoluteUrl(siteUrl: string, path: string): string {
  return new URL(path, siteUrl).toString();
}

/** robots.txt body — allows everything, points crawlers at the sitemap `@astrojs/sitemap` builds. */
export function robotsTxt(siteUrl: string): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl(siteUrl, "/sitemap-index.xml")}\n`;
}

export interface MetaTags {
  title: string;
  description: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  /** Explicit `seo.ogImage` when set, otherwise the build-generated fallback card (see og-image.ts). Always present. */
  ogImage: string;
  ogUrl: string;
  ogSiteName: string;
  /** Every client in this fleet is a US local-service business (see `seo.region`). */
  ogLocale: string;
}

export function metaTags(config: ClientConfig): MetaTags {
  const { business, seo } = config;
  return {
    title: seo.title,
    description: seo.description,
    canonical: seo.siteUrl,
    ogTitle: seo.title,
    ogDescription: seo.description,
    ogImage: absoluteUrl(seo.siteUrl, seo.ogImage ?? OG_IMAGE_PATH),
    ogUrl: seo.siteUrl,
    ogSiteName: business.name,
    ogLocale: "en_US",
  };
}
