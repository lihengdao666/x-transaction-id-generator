# x-transaction-id-generator

一个轻量的 X Web 请求 transaction ID 生成器。

[English](./README.md)

## 功能

本库用于生成 X Web 请求头 `x-client-transaction-id` 的值。

它只负责解析和生成，不负责网络请求。你可以自行使用 `fetch`、`axios`、代理、cookies、重试逻辑或已有 HTTP 客户端。

## 安装

```bash
npm install x-transaction-id-generator
```

## 使用

```ts
import {
  generateTransactionId,
  resolveOnDemandFileUrlFromRuntime,
} from "x-transaction-id-generator";

const homeHtml = await fetch("https://x.com/i/jf/").then((res) => res.text());

const ondemandUrl = resolveOnDemandFileUrlFromRuntime(homeHtml);
if (!ondemandUrl) {
  throw new Error("ondemand.s URL not found");
}

const ondemandSource = await fetch(ondemandUrl).then((res) => res.text());

const transactionId = await generateTransactionId("GET", "/i/api/graphql/example/ExampleQuery", {
  homeHtml,
  ondemandSource,
});
```

## 可复用 Generator

如果要基于同一份页面元数据生成多个 ID，可以创建可复用 generator。

```ts
import { createTransactionIdGenerator } from "x-transaction-id-generator";

const generator = createTransactionIdGenerator({
  homeHtml,
  ondemandSource,
});

const transactionId = await generator.generate("POST", "/i/api/graphql/example/MutationName");
```

## API

```ts
generateTransactionId(method, path, options)
createTransactionIdGenerator(options)
resolveOnDemandFileUrlFromRuntime(source)
parseOndemandIndices(source)
extractTransactionContext(homeHtml)
extractSiteVerificationKey(homeHtml)
extractLoadingAnimationFrames(homeHtml)
generateAnimationKey(key, frames, indices, options)
```

## 注意事项

- `homeHtml` 应为 X app shell HTML。
- `ondemandSource` 应为解析出的 `ondemand.s` chunk 源码。
- `path` 可以是 URL path 或完整 URL。query string 不参与哈希。
- 本库不提供认证、cookies、抓取或 HTTP 重试能力。

## 参考

- https://h3d4.top/posts/x-client-transaction-id.html

## License

MIT
