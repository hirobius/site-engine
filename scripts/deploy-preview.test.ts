import { describe, expect, it, vi } from "vitest";
import {
  assertPreviewTarget,
  basicAuthFilePath,
  buildPreviewUrl,
  disableSsoProtection,
  ensureBasicAuthCreds,
  ensurePreviewToken,
  extractDeployUrl,
  projectLinkPath,
  projectName,
  readProjectLink,
  requireVercelToken,
  runPreviewDeploy,
  setBasicAuthEnv,
  setPreviewTokenEnv,
  tokenFilePath,
  verifyPreviewGate,
  type FsLike,
} from "./deploy-preview.js";

/** Minimal in-memory stand-in for the FsLike surface deploy-preview needs. */
function makeFakeFs(initial: Record<string, string> = {}): FsLike {
  const files = new Map(Object.entries(initial));
  return {
    existsSync: ((path: string) => files.has(path)) as FsLike["existsSync"],
    readFileSync: ((path: string) => {
      const content = files.get(path as string);
      if (content === undefined) throw new Error(`ENOENT: ${path}`);
      return content;
    }) as FsLike["readFileSync"],
    writeFileSync: ((path: string, data: string) => {
      files.set(path as string, data as string);
    }) as FsLike["writeFileSync"],
    mkdirSync: (() => undefined) as FsLike["mkdirSync"],
  };
}

describe("requireVercelToken", () => {
  it("fails loud, naming VERCEL_TOKEN and the fix, when it is missing", () => {
    expect(() => requireVercelToken({})).toThrow(Error);
    try {
      requireVercelToken({});
      expect.unreachable();
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain("VERCEL_TOKEN");
      expect(message).toContain("https://vercel.com/account/tokens");
      expect(message).toContain("export VERCEL_TOKEN=");
    }
  });

  it("returns the token when set", () => {
    expect(requireVercelToken({ VERCEL_TOKEN: "abc123" })).toBe("abc123");
  });
});

describe("assertPreviewTarget — the never-production guard", () => {
  it("throws if --prod is present, even alongside --target=preview", () => {
    expect(() => assertPreviewTarget(["deploy", "--target=preview", "--prod"])).toThrow(/preview-only/);
  });

  it("throws if -p (short prod flag) is present", () => {
    expect(() => assertPreviewTarget(["deploy", "-p"])).toThrow(/preview-only/);
  });

  it("throws if --target=preview is missing entirely", () => {
    expect(() => assertPreviewTarget(["deploy", "--cwd", "ejected/mikes-junk"])).toThrow(/--target=preview/);
  });

  it("does not throw for a correctly-guarded preview deploy", () => {
    expect(() => assertPreviewTarget(["deploy", "--target=preview", "--cwd", "ejected/mikes-junk"])).not.toThrow();
  });
});

describe("runPreviewDeploy", () => {
  it("never invokes vercel with --prod, always with --target=preview", () => {
    const spawnImpl = vi.fn().mockReturnValue({ status: 0, stdout: "https://mikes-junk-abc123.vercel.app", stderr: "" });
    runPreviewDeploy("ejected/mikes-junk", "tok", spawnImpl);
    expect(spawnImpl).toHaveBeenCalledWith(
      "vercel",
      expect.arrayContaining(["deploy", "--target=preview"]),
      expect.anything(),
    );
    const calledArgs = spawnImpl.mock.calls[0]![1] as string[];
    expect(calledArgs).not.toContain("--prod");
  });

  it("throws with the vercel stderr when the deploy fails", () => {
    const spawnImpl = vi.fn().mockReturnValue({ status: 1, stdout: "", stderr: "Error: not linked" });
    expect(() => runPreviewDeploy("ejected/mikes-junk", "tok", spawnImpl)).toThrow(/not linked/);
  });
});

describe("extractDeployUrl / buildPreviewUrl — URL assembly", () => {
  it("pulls the .vercel.app URL out of vercel deploy's stdout", () => {
    const stdout = "Vercel CLI 39.1.0\nInspect: https://vercel.com/team/proj/xyz\nhttps://mikes-junk-abc123.vercel.app\n";
    expect(extractDeployUrl(stdout)).toBe("https://mikes-junk-abc123.vercel.app");
  });

  it("throws a readable error when no deployment URL is found", () => {
    expect(() => extractDeployUrl("some unrelated output")).toThrow(/deployment URL/);
  });

  it("appends ?key=<token> to the deployment URL", () => {
    expect(buildPreviewUrl("https://mikes-junk-abc123.vercel.app", "deadbeef")).toBe(
      "https://mikes-junk-abc123.vercel.app/?key=deadbeef",
    );
  });

  it("merges cleanly with a URL that already has a path or query", () => {
    expect(buildPreviewUrl("https://mikes-junk-abc123.vercel.app/?foo=bar", "deadbeef")).toBe(
      "https://mikes-junk-abc123.vercel.app/?foo=bar&key=deadbeef",
    );
  });
});

describe("ensurePreviewToken — idempotent re-run", () => {
  it("generates and persists a token on first run", () => {
    const fs = makeFakeFs();
    const token = ensurePreviewToken("ejected/mikes-junk", fs);
    expect(token).toMatch(/^[0-9a-f]{32}$/);
    expect(fs.existsSync(tokenFilePath("ejected/mikes-junk"))).toBe(true);
  });

  it("reuses the persisted token on a second run instead of generating a new one", () => {
    const fs = makeFakeFs();
    const first = ensurePreviewToken("ejected/mikes-junk", fs);
    const second = ensurePreviewToken("ejected/mikes-junk", fs);
    expect(second).toBe(first);
  });

  it("returns the same token across independent invocations sharing persisted state", () => {
    const path = tokenFilePath("ejected/mikes-junk");
    const fs = makeFakeFs({ [path]: "cafef00d\n" });
    expect(ensurePreviewToken("ejected/mikes-junk", fs)).toBe("cafef00d");
  });
});

describe("setPreviewTokenEnv — idempotent regardless of prior state", () => {
  it("always removes then adds, so a re-run converges instead of erroring on 'already exists'", () => {
    const spawnImpl = vi.fn().mockReturnValue({ status: 0, stdout: "", stderr: "" });
    setPreviewTokenEnv("ejected/mikes-junk", "tok123", "vercel-tok", spawnImpl);
    expect(spawnImpl).toHaveBeenCalledTimes(2);
    expect(spawnImpl.mock.calls[0]![1]).toEqual(
      expect.arrayContaining(["env", "rm", "PREVIEW_TOKEN", "preview"]),
    );
    expect(spawnImpl.mock.calls[1]![1]).toEqual(
      expect.arrayContaining(["env", "add", "PREVIEW_TOKEN", "preview"]),
    );
  });

  it("does not fail the run when the rm step errors (var did not exist yet)", () => {
    const spawnImpl = vi
      .fn()
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "not found" })
      .mockReturnValueOnce({ status: 0, stdout: "", stderr: "" });
    expect(setPreviewTokenEnv("ejected/mikes-junk", "tok123", "vercel-tok", spawnImpl)).toBe(true);
  });

  it("passes the token value as stdin to the add step, not as an argv value", () => {
    const spawnImpl = vi.fn().mockReturnValue({ status: 0, stdout: "", stderr: "" });
    setPreviewTokenEnv("ejected/mikes-junk", "super-secret-token", "vercel-tok", spawnImpl);
    const addArgs = spawnImpl.mock.calls[1]![1] as string[];
    expect(addArgs.join(" ")).not.toContain("super-secret-token");
    expect(spawnImpl.mock.calls[1]![2]).toEqual(expect.objectContaining({ input: "super-secret-token\n" }));
  });

  it("returns false when the add step ultimately fails", () => {
    const spawnImpl = vi.fn().mockReturnValue({ status: 1, stdout: "", stderr: "boom" });
    expect(setPreviewTokenEnv("ejected/mikes-junk", "tok123", "vercel-tok", spawnImpl)).toBe(false);
  });
});

describe("ensureBasicAuthCreds — idempotent re-run", () => {
  it("generates and persists creds on first run, user fixed as 'preview'", () => {
    const fs = makeFakeFs();
    const creds = ensureBasicAuthCreds("ejected/mikes-junk", fs);
    expect(creds.user).toBe("preview");
    expect(creds.pass).toMatch(/^[0-9a-f]{24}$/);
    expect(fs.existsSync(basicAuthFilePath("ejected/mikes-junk"))).toBe(true);
  });

  it("reuses the persisted creds on a second run instead of generating new ones", () => {
    const fs = makeFakeFs();
    const first = ensureBasicAuthCreds("ejected/mikes-junk", fs);
    const second = ensureBasicAuthCreds("ejected/mikes-junk", fs);
    expect(second).toEqual(first);
  });
});

describe("setBasicAuthEnv — idempotent regardless of prior state", () => {
  it("sets both PREVIEW_USER and PREVIEW_PASS via rm-then-add", () => {
    const spawnImpl = vi.fn().mockReturnValue({ status: 0, stdout: "", stderr: "" });
    const ok = setBasicAuthEnv("ejected/mikes-junk", { user: "preview", pass: "secretpass" }, "vercel-tok", spawnImpl);
    expect(ok).toBe(true);
    expect(spawnImpl).toHaveBeenCalledTimes(4);
    const commands = spawnImpl.mock.calls.map((c) => (c[1] as string[]).slice(0, 3).join(" "));
    expect(commands).toEqual([
      "env rm PREVIEW_USER",
      "env add PREVIEW_USER",
      "env rm PREVIEW_PASS",
      "env add PREVIEW_PASS",
    ]);
  });

  it("returns false if either var fails to set", () => {
    const spawnImpl = vi
      .fn()
      .mockReturnValueOnce({ status: 0, stdout: "", stderr: "" }) // rm USER
      .mockReturnValueOnce({ status: 0, stdout: "", stderr: "" }) // add USER
      .mockReturnValueOnce({ status: 0, stdout: "", stderr: "" }) // rm PASS
      .mockReturnValueOnce({ status: 1, stdout: "", stderr: "boom" }); // add PASS fails
    const ok = setBasicAuthEnv("ejected/mikes-junk", { user: "preview", pass: "secretpass" }, "vercel-tok", spawnImpl);
    expect(ok).toBe(false);
  });
});

describe("verifyPreviewGate — proves the DoD (200 with key, closed without)", () => {
  it("passes both checks when the key works and the bare URL is rejected", async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      const status = new URL(url).searchParams.has("key") ? 200 : 401;
      return Promise.resolve({ status } as Response);
    });
    const result = await verifyPreviewGate("https://mikes-junk-abc123.vercel.app/?key=deadbeef", fetchImpl);
    expect(result.withKey).toEqual({ pass: true, detail: "status 200" });
    expect(result.withoutKey).toEqual({ pass: true, detail: "status 401" });
  });

  it("fails the withoutKey check if the bare URL is still 200 (gate not actually closed)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ status: 200 } as Response);
    const result = await verifyPreviewGate("https://mikes-junk-abc123.vercel.app/?key=deadbeef", fetchImpl);
    expect(result.withoutKey.pass).toBe(false);
  });

  it("fails the withKey check if the keyed link doesn't resolve", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ status: 401 } as Response);
    const result = await verifyPreviewGate("https://mikes-junk-abc123.vercel.app/?key=deadbeef", fetchImpl);
    expect(result.withKey.pass).toBe(false);
  });

  it("strips the key query param (not just the value) when checking the closed path", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ status: 401 } as Response);
    await verifyPreviewGate("https://mikes-junk-abc123.vercel.app/?key=deadbeef", fetchImpl);
    const secondCallUrl = fetchImpl.mock.calls[1]![0] as string;
    expect(new URL(secondCallUrl).searchParams.has("key")).toBe(false);
  });
});

describe("readProjectLink", () => {
  it("reads projectId/orgId out of .vercel/project.json", () => {
    const fs = makeFakeFs({
      [projectLinkPath("ejected/mikes-junk")]: JSON.stringify({ projectId: "prj_abc", orgId: "team_xyz" }),
    });
    expect(readProjectLink("ejected/mikes-junk", fs)).toEqual({ projectId: "prj_abc", orgId: "team_xyz" });
  });

  it("fails loud when vercel link hasn't run yet (no project.json)", () => {
    const fs = makeFakeFs();
    expect(() => readProjectLink("ejected/mikes-junk", fs)).toThrow(/vercel link/);
  });
});

describe("disableSsoProtection", () => {
  const link = { projectId: "prj_abc", orgId: "team_xyz" };

  it("returns ok:true when the API call succeeds", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true } as Response);
    const result = await disableSsoProtection(link, "hirobius-mikes-junk", "vercel-tok", fetchImpl);
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining("prj_abc"),
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("returns ok:false + a clickable deep link when the API rejects the write", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false } as Response);
    const result = await disableSsoProtection(link, "hirobius-mikes-junk", "vercel-tok", fetchImpl);
    expect(result.ok).toBe(false);
    expect(result.deepLink).toBe("https://vercel.com/team_xyz/hirobius-mikes-junk/settings/deployment-protection");
  });

  it("returns ok:false + the deep link when fetch throws (e.g. offline)", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network unreachable"));
    const result = await disableSsoProtection(link, "hirobius-mikes-junk", "vercel-tok", fetchImpl);
    expect(result.ok).toBe(false);
    expect(result.deepLink).toContain("settings/deployment-protection");
  });
});

describe("projectName", () => {
  it("matches the new-client.ts fleet convention", () => {
    expect(projectName("mikes-junk")).toBe("hirobius-mikes-junk");
  });
});
