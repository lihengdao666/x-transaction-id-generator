/**
 * Metadata extracted from the X app shell HTML.
 * 从 X 页面 HTML 中提取出的 transaction 元数据。
 */
export interface TransactionContext {
  key: string;
  frames: string[];
}

/**
 * Options for animation key derivation.
 * 生成 animation key 的配置。
 */
export interface GenerateAnimationKeyOptions {
  epsilon?: number;
}

/**
 * Options for generating one transaction ID.
 * 生成单个 transaction ID 的配置。
 */
export interface GenerateTransactionIdOptions extends GenerateAnimationKeyOptions {
  key?: string;
  animationKey?: string;
  frames?: string[];
  indices?: number[];
  homeHtml?: string;
  ondemandSource?: string;
  now?: number;
  mask?: number;
}

/**
 * Options for creating a reusable generator.
 * 创建可复用 generator 的配置。
 */
export interface TransactionIdGeneratorOptions extends GenerateAnimationKeyOptions {
  key?: string;
  homeHtml?: string;
  ondemandSource?: string;
  frames?: string[];
  indices?: number[];
}

/**
 * Reusable transaction ID generator with cached metadata.
 * 带缓存元数据的可复用 transaction ID 生成器。
 */
export interface TransactionIdGenerator {
  readonly key: string;
  readonly frames: string[] | null;
  readonly indices: number[] | null;
  generate(method: string, path: string, options?: Omit<GenerateTransactionIdOptions, "key" | "frames" | "indices" | "homeHtml" | "ondemandSource">): Promise<string>;
}
