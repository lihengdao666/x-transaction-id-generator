const ON_DEMAND_CHUNK_NAME = "ondemand.s";
const INDICES_REGEX = /\(\w\[(\d{1,2})\],\s*16\)/g;
const ON_DEMAND_FILE_HASH_REGEX =
  /(\d+):\s*["']ondemand\.s["'][\s\S]*?\}\)\[e\]\s*\|\|\s*e\)\s*\+\s*["']\.["']\s*\+\s*\(\{[\s\S]*?\b\1:\s*["']([a-zA-Z0-9_-]+)["']/s;

/**
 * Parse key-byte indices from the ondemand.s JavaScript source.
 * 从 ondemand.s JavaScript 源码中解析 key 字节索引。
 */
export function parseOndemandIndices(source: string): number[] {
  const indices: number[] = [];
  INDICES_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INDICES_REGEX.exec(String(source))) !== null) {
    indices.push(Number(match[1]));
  }
  if (indices.length < 4) {
    throw new Error("ondemand.s indices not found");
  }
  return indices;
}

/**
 * Resolve the current ondemand.s chunk URL from X runtime source or HTML.
 * 从 X runtime 源码或 HTML 中解析当前 ondemand.s chunk URL。
 */
export function resolveOnDemandFileUrlFromRuntime(source: string): string | null {
  const match = ON_DEMAND_FILE_HASH_REGEX.exec(String(source));
  if (!match) return null;
  return `https://abs.twimg.com/responsive-web/client-web/${ON_DEMAND_CHUNK_NAME}.${match[2]}a.js`;
}
