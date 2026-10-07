import { parseHTML } from "linkedom";
import type { TransactionContext } from "./types.js";

function parseDocument(html: string): Document {
  return parseHTML(String(html)).document;
}

function extractSiteVerificationKeyFromDocument(document: Document): string | null {
  const verification = document.querySelector<HTMLMetaElement>('meta[name="twitter-site-verification"]');
  const content = verification?.getAttribute("content");
  if (content) return content;

  for (const meta of Array.from(document.querySelectorAll<HTMLMetaElement>("meta[name^='tw']"))) {
    const fallback = meta.getAttribute("content");
    if (fallback) return fallback;
  }
  return null;
}

function extractLoadingAnimationFramesFromDocument(document: Document): string[] {
  let svgs = Array.from(document.querySelectorAll<SVGSVGElement>("svg[id^='loading-x-anim']"));

  if (svgs.length < 4) {
    svgs = Array.from(document.querySelectorAll<SVGSVGElement>("svg.r-4uwx00"));
  }

  if (svgs.length < 4) {
    throw new Error("loading-x-anim frames not found");
  }

  return svgs.map((svg) => {
    const paths = Array.from(svg.querySelectorAll<SVGPathElement>("path"));
    if (paths.length < 2) {
      throw new Error("animation path missing from loading-x-anim frame");
    }
    const frame = paths[1].getAttribute("d");
    if (!frame) {
      throw new Error("animation path d attribute missing from loading-x-anim frame");
    }
    return frame;
  });
}

/**
 * Extract the base64 site verification key from X app shell HTML.
 * 从 X 页面 HTML 中提取 base64 站点校验 key。
 */
export function extractSiteVerificationKey(html: string): string | null {
  return extractSiteVerificationKeyFromDocument(parseDocument(html));
}

/**
 * Extract loading animation SVG path frames used to derive the animation key.
 * 提取用于生成 animation key 的 loading 动画 SVG path 帧。
 */
export function extractLoadingAnimationFrames(html: string): string[] {
  return extractLoadingAnimationFramesFromDocument(parseDocument(html));
}

/**
 * Extract all HTML-derived transaction metadata in one call.
 * 一次性提取所有来自 HTML 的 transaction 元数据。
 */
export function extractTransactionContext(html: string): TransactionContext {
  const document = parseDocument(html);
  const key = extractSiteVerificationKeyFromDocument(document);
  if (!key) {
    throw new Error("twitter-site-verification key not found");
  }
  return {
    key,
    frames: extractLoadingAnimationFramesFromDocument(document),
  };
}
