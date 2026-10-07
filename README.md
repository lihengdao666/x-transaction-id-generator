# x-transaction-id-generator

Fast, lightweight utilities for generating the `x-client-transaction-id` header used by X web requests.

This project focuses on a small, inspectable implementation: extract the required web metadata, derive the animation key, and generate transaction IDs without pulling in a large browser runtime.

> This project is not affiliated with X Corp. Use responsibly and follow the terms of service of any service you interact with.

## Features

- Generates `x-client-transaction-id` values for X web API requests.
- Designed for low overhead and easy integration in Node.js projects.
- Keeps parsing and generation logic explicit, testable, and portable.
- Suitable for caching the expensive metadata extraction step and reusing it across requests.

## Install

```bash
npm install x-transaction-id-generator
```

## Quick Start

```ts
import { createTransactionIdGenerator } from "x-transaction-id-generator";

const html = await fetch("https://x.com/i/jf/").then((res) => res.text());

const generator = await createTransactionIdGenerator({ html });

const transactionId = await generator.generate("GET", "/i/api/graphql/example/ExampleQuery");

console.log(transactionId);
```

Use the generated value as a request header:

```ts
await fetch("https://x.com/i/api/graphql/example/ExampleQuery", {
  method: "GET",
  headers: {
    "x-client-transaction-id": transactionId,
  },
});
```

## Recommended Usage

Transaction metadata should be cached and reused. Fetching and parsing the X web shell on every request is much slower than generating the ID itself.

```ts
const generator = await createTransactionIdGenerator({ html });

for (const path of paths) {
  const id = await generator.generate("GET", path);
  // Send your request with the generated header.
}
```

## API

### `createTransactionIdGenerator(options)`

Creates a reusable generator instance.

```ts
const generator = await createTransactionIdGenerator({ html });
```

Options:

- `html`: the X web shell HTML used to extract verification and animation metadata.
- `onDemandJs`: optional pre-fetched JavaScript chunk content when you want to avoid internal fetching.
- `fetch`: optional custom fetch implementation for proxies, retries, or test fixtures.

### `generator.generate(method, path)`

Generates one transaction ID.

```ts
const id = await generator.generate("POST", "/i/api/graphql/example/MutationName");
```

Parameters:

- `method`: HTTP method such as `GET` or `POST`.
- `path`: URL path only, without scheme, host, or query string.

## Performance Notes

The expensive work is metadata discovery, not per-request ID generation. For best performance:

- Create the generator once and reuse it.
- Cache fetched HTML and on-demand JavaScript when possible.
- Refresh cached metadata only when generation starts failing or X rotates web assets.
- Avoid reparsing the full HTML document for every outgoing request.

## Roadmap

- TypeScript-first public API.
- Fixture-based tests for stable parser behavior.
- Optional native parser backend for high-throughput workloads.
- Browser-compatible build if there is a clear use case.

## Legal

This package is provided for research, interoperability, and educational purposes. You are responsible for how you use it.

## License

MIT
