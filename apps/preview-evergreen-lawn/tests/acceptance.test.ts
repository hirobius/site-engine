import { describe, expect, it } from "vitest";
import { checkClientAcceptance } from "@hirobius/template";
import { client } from "../client.config";

/**
 * Cold-outreach preview: intake hasn't landed, so `realData` stays false and
 * the placeholder phone/email/siteUrl/form-key are expected. Flip to `true`
 * once real business data replaces them — that's what turns this suite into the
 * guard against shipping a `.example` URL to a real client.
 */
describe("preview-evergreen-lawn acceptance", () => {
  it("has no acceptance issues as a preview site", () => {
    expect(checkClientAcceptance(client)).toEqual([]);
  });
});
