import { describe, expect, it } from "vitest";
import { checkClientAcceptance } from "@hirobius/template";
import { client } from "../client.config";

/**
 * Canonical scaffold: intake hasn't landed, so realData stays false and the
 * placeholder phone/email/siteUrl/form-key are expected. `pnpm new-client`
 * copies this whole app, so this test is what every fresh scaffold inherits
 * (issue #78 — previously _template had no tests/ dir at all).
 */
describe("_template acceptance", () => {
  it("has no acceptance issues as a preview scaffold", () => {
    expect(checkClientAcceptance(client)).toEqual([]);
  });
});
