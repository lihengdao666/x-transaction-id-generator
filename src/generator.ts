import { createHash, randomInt } from "node:crypto";
import { extractTransactionContext } from "./html.js";
import { parseOndemandIndices } from "./ondemand.js";
import { generateAnimationKey } from "./animation.js";
import type { GenerateTransactionIdOptions, TransactionIdGenerator, TransactionIdGeneratorOptions } from "./types.js";

const EPOCH_MS = 1682924400000;
const KEYWORD = "obfiowerehiring";
const VERSION = 3;
const DIGEST_BYTES = 16;

function timeNowSeconds(now = Date.now()): number {
  return Math.floor((now - EPOCH_MS) / 1000);
}

function requestPathFromUrl(value: string): string {
  if (typeof value !== "string") {
    throw new TypeError("path must be a string");
  }

  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return new URL(trimmed).pathname.trim();
  }
  return trimmed.split("?")[0].trim();
}

/**
 * Generate one X web request transaction ID.
 * 生成一个 X Web 请求 transaction ID。
 */
export async function generateTransactionId(
  method: string,
  path: string,
  options: GenerateTransactionIdOptions = {},
): Promise<string> {
  const {
    key,
    animationKey,
    frames,
    indices,
    homeHtml,
    ondemandSource,
    epsilon,
    now = Date.now(),
    mask,
  } = options;

  if (typeof method !== "string" || typeof path !== "string") {
    throw new TypeError("method and path must be strings");
  }

  const requestPath = requestPathFromUrl(path);
  const context = homeHtml ? extractTransactionContext(homeHtml) : null;
  const effectiveKey = key ?? context?.key;

  if (typeof effectiveKey !== "string" || effectiveKey.length === 0) {
    throw new Error('key is required: pass the base64 content of <meta name="twitter-site-verification">');
  }

  const keyBytes = Buffer.from(effectiveKey, "base64");
  const contextFrames = frames ?? context?.frames ?? null;
  const contextIndices = indices ?? (ondemandSource ? parseOndemandIndices(ondemandSource) : null);
  const fingerprint = animationKey ?? (contextFrames && contextIndices ? generateAnimationKey(effectiveKey, contextFrames, contextIndices, { epsilon }) : null);
  if (!fingerprint) {
    throw new Error("animation metadata is required: pass animationKey or provide frames and indices");
  }
  const timeSeconds = timeNowSeconds(now);
  const timeBytes = Buffer.alloc(4);
  timeBytes.writeUInt32LE(timeSeconds, 0);

  const hashInput = `${method}!${requestPath}!${timeSeconds}${KEYWORD}${fingerprint}`;
  const digest = createHash("sha256").update(hashInput).digest().subarray(0, DIGEST_BYTES);
  const payload = Buffer.concat([keyBytes, timeBytes, digest, Buffer.from([VERSION])]);

  const maskByte = mask ?? randomInt(0, 256);
  if (!Number.isInteger(maskByte) || maskByte < 0 || maskByte > 255) {
    throw new RangeError("mask must be an integer between 0 and 255");
  }

  const out = Buffer.alloc(payload.length + 1);
  out[0] = maskByte;
  // The first byte is the XOR mask; every payload byte is encoded with it.
  for (let i = 0; i < payload.length; i += 1) {
    out[i + 1] = payload[i] ^ maskByte;
  }
  return out.toString("base64").replace(/=+$/, "");
}

/**
 * Create a reusable generator that caches key, frames, and ondemand indices.
 * 创建一个可复用 generator，用于缓存 key、动画帧和 ondemand 索引。
 */
export function createTransactionIdGenerator(options: TransactionIdGeneratorOptions): TransactionIdGenerator {
  const context = options.homeHtml ? extractTransactionContext(options.homeHtml) : null;
  const key = options.key ?? context?.key;
  if (!key) {
    throw new Error('key is required: pass options.key or options.homeHtml with <meta name="twitter-site-verification">');
  }

  const frames = options.frames ?? context?.frames ?? null;
  const indices = options.indices ?? (options.ondemandSource ? parseOndemandIndices(options.ondemandSource) : null);
  const epsilon = options.epsilon;

  return {
    key,
    frames,
    indices,
    generate(method, path, generateOptions = {}) {
      return generateTransactionId(method, path, {
        ...generateOptions,
        key,
        frames: frames ?? undefined,
        indices: indices ?? undefined,
        epsilon: generateOptions.epsilon ?? epsilon,
      });
    },
  };
}
