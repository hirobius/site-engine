import { describe, expect, it } from "vitest";
import { checkClientAcceptance } from "@hirobius/template";
import { client } from "../client.config";

/**
 * Cold-outreach preview: intake hasn't landed, so `realData` stays false and
 * the placeholder phone/email/siteUrl/form-key are expected. Flip to `true`
 * once real business data replaces them (see client.config.ts's own header
 * comment) — that's what turns this suite into the guard against shipping a
 * `.example` URL to a real client, the bug this suite exists to catch.
 */
describe("preview-clearout-junk acceptance", () => {
  it("has no acceptance issues as a preview site", () => {
    expect(checkClientAcceptance(client)).toEqual([]);
  });
});
