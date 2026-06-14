/**
 * Minimal client for the Google Places API (New) Text Search.
 *
 * Endpoint: POST https://places.googleapis.com/v1/places:searchText
 * Auth: an API key with "Places API (New)" enabled, in X-Goog-Api-Key.
 * Paging: up to 20 results/page, 3 pages (60 max) per query via nextPageToken.
 *
 * Using the official API (not scraping Maps) keeps this within Google's ToS.
 */

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.primaryType",
  "places.location",
  "places.businessStatus",
  "nextPageToken",
].join(",");

export interface Place {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  primaryType?: string;
  location?: { latitude: number; longitude: number };
  businessStatus?: string;
}

interface SearchResponse {
  places?: Place[];
  nextPageToken?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run one text query, paging up to `maxResults` (cap 60). Returns the places.
 * Throws on auth/quota errors so the caller can stop early.
 */
export async function searchText(
  apiKey: string,
  textQuery: string,
  maxResults = 60,
): Promise<Place[]> {
  const out: Place[] = [];
  let pageToken: string | undefined;

  do {
    const body: Record<string, unknown> = {
      textQuery,
      pageSize: 20,
      regionCode: "US",
      ...(pageToken ? { pageToken } : {}),
    };

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
      // Safety net: never let a stalled request hang the whole sweep.
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Places API ${res.status}: ${text.slice(0, 300)}`);
    }

    const data = (await res.json()) as SearchResponse;
    out.push(...(data.places ?? []));
    pageToken = data.nextPageToken;

    // The next page token needs a moment to become valid.
    if (pageToken && out.length < maxResults) await sleep(2000);
  } while (pageToken && out.length < maxResults);

  return out.slice(0, maxResults);
}
