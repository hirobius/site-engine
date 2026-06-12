import type { ClientConfig } from "@hirobius/schema";

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
    openingHoursSpecification: business.hours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: h.days,
      // Free-form display string; structured times are not always known.
      description: h.hours,
    })),
  };

  if (seo.ogImage) {
    jsonLd.image = absoluteUrl(seo.siteUrl, seo.ogImage);
  }

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

export interface MetaTags {
  title: string;
  description: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogImage?: string;
  ogUrl: string;
}

export function metaTags(config: ClientConfig): MetaTags {
  const { seo } = config;
  return {
    title: seo.title,
    description: seo.description,
    canonical: seo.siteUrl,
    ogTitle: seo.title,
    ogDescription: seo.description,
    ogImage: seo.ogImage ? absoluteUrl(seo.siteUrl, seo.ogImage) : undefined,
    ogUrl: seo.siteUrl,
  };
}
