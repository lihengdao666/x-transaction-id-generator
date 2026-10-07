import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  createTransactionIdGenerator,
  extractLoadingAnimationFrames,
  extractSiteVerificationKey,
  extractTransactionContext,
  generateAnimationKey,
  generateTransactionId,
  parseOndemandIndices,
  resolveOnDemandFileUrlFromRuntime,
} from "./index.js";

const KEY = "AQIDBAUGBwgJCg";
const METHOD = "GET";
const PATH = "/graphql/UserByScreenName";
const NOW = 1760000000000;
const D = "0deadbeefcafe";
const MASK = 0x5a;
const EXPECTED = "WltYWV5fXF1SU1DKTsJeQ1QK3czJSPrm85T5eQ+yq1k";

function fixtureHomeHtml(): string {
  const row = (offset: number) => Array.from({ length: 11 }, (_, index) => 10 + offset + index).join(" ");
  const framePath = `M0 0 0 0 ${Array.from({ length: 16 }, (_, index) => row(index)).join("C")}`;
  return `
    <html><head><meta name="twitter-site-verification" content="${KEY}"></head>
    <body>
      ${Array.from({ length: 4 }, (_, index) =>
        `<svg id="loading-x-anim-${index}"><path d="M0"></path><path d="${framePath}"></path></svg>`,
      ).join("")}
    </body></html>
  `;
}

test("generates deterministic transaction ID", async () => {
  const id = await generateTransactionId(METHOD, PATH, {
    key: KEY,
    animationKey: D,
    now: NOW,
    mask: MASK,
  });

  assert.equal(id, EXPECTED);
  assert.equal(id.includes("="), false);

  const decoded = Buffer.from(id, "base64");
  const keyBytes = Buffer.from(KEY, "base64");
  const timeSeconds = Math.floor((NOW - 1682924400000) / 1000);
  const timeBytes = Buffer.alloc(4);
  timeBytes.writeUInt32LE(timeSeconds, 0);
  const hashInput = `${METHOD}!${PATH}!${timeSeconds}obfiowerehiring${D}`;
  const digest = createHash("sha256").update(hashInput).digest().subarray(0, 16);
  const payload = Buffer.concat([keyBytes, timeBytes, digest, Buffer.from([3])]);

  assert.equal(decoded.length, payload.length + 1);
  assert.equal(decoded[0], MASK);
  assert.deepEqual(decoded.subarray(1), Buffer.from(payload.map((byte) => byte ^ MASK)));
});

test("extracts page metadata and derives animation key", async () => {
  const homeHtml = fixtureHomeHtml();
  const ondemandSource = "a(n[1], 16);b(n[2], 16);c(n[3], 16);d(n[4], 16);";
  const frames = extractLoadingAnimationFrames(homeHtml);
  const indices = parseOndemandIndices(ondemandSource);
  const animationKey = generateAnimationKey(KEY, frames, indices);

  assert.equal(extractSiteVerificationKey(homeHtml), KEY);
  assert.equal(extractTransactionContext(homeHtml).key, KEY);
  assert.equal(frames.length, 4);
  assert.deepEqual(indices, [1, 2, 3, 4]);
  assert.match(animationKey, /^[0-9a-fA-F]+$/);

  assert.equal(
    await generateTransactionId(METHOD, PATH, { homeHtml, ondemandSource, now: NOW, mask: MASK }),
    await generateTransactionId(METHOD, PATH, { key: KEY, animationKey, now: NOW, mask: MASK }),
  );
});

test("extracts metadata from DOM variants", () => {
  const row = (offset: number) => Array.from({ length: 11 }, (_, index) => 10 + offset + index).join(" ");
  const framePath = `M0 0 0 0 ${Array.from({ length: 16 }, (_, index) => row(index)).join("C")}`;
  const homeHtml = `
    <html><head><meta content="${KEY}" name="twitter-site-verification"></head>
    <body>
      ${Array.from({ length: 4 }, () =>
        `<svg class="r-4uwx00 other"><path d="M0"></path><path d="${framePath}"></path></svg>`,
      ).join("\n")}
    </body></html>
  `;

  assert.equal(extractSiteVerificationKey(homeHtml), KEY);
  assert.equal(extractLoadingAnimationFrames(homeHtml).length, 4);
});

test("creates reusable generator", async () => {
  const homeHtml = fixtureHomeHtml();
  const ondemandSource = "a(n[1], 16);b(n[2], 16);c(n[3], 16);d(n[4], 16);";
  const generator = createTransactionIdGenerator({ homeHtml, ondemandSource });
  const direct = await generateTransactionId(METHOD, PATH, { homeHtml, ondemandSource, now: NOW, mask: MASK });
  const reused = await generator.generate(METHOD, PATH, { now: NOW, mask: MASK });

  assert.equal(generator.key, KEY);
  assert.equal(reused, direct);
});

test("normalizes request URLs and resolves ondemand URLs", async () => {
  assert.equal(
    await generateTransactionId(METHOD, `${PATH}?variables=ignored`, { key: KEY, animationKey: D, now: NOW, mask: MASK }),
    EXPECTED,
  );
  assert.equal(
    await generateTransactionId(METHOD, `https://x.com${PATH}?variables=ignored`, { key: KEY, animationKey: D, now: NOW, mask: MASK }),
    EXPECTED,
  );
  assert.equal(
    resolveOnDemandFileUrlFromRuntime('123:"ondemand.s";x=({123:"ondemand.s"})[e]||e)+"."+({123:"abc_123"}[e])'),
    "https://abs.twimg.com/responsive-web/client-web/ondemand.s.abc_123a.js",
  );
});

test("resolves ondemand source URL for caller-managed fetching", async () => {
  const homeHtml = `${fixtureHomeHtml()}<script>123:"ondemand.s";x=({123:"ondemand.s"})[e]||e)+"."+({123:"abc_123"}[e])</script>`;
  assert.equal(
    resolveOnDemandFileUrlFromRuntime(homeHtml),
    "https://abs.twimg.com/responsive-web/client-web/ondemand.s.abc_123a.js",
  );
});

test("requires a key", async () => {
  await assert.rejects(() => generateTransactionId("GET", "/x", {}), /key is required/);
});

test("requires animation metadata or a precomputed animation key", async () => {
  await assert.rejects(
    () => generateTransactionId("GET", "/x", { key: KEY }),
    /animation metadata is required/,
  );
});
