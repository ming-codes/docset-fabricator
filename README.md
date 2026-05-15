# Docset Fabricator

Docset Fabricator is a CLI tool that scrapes documentation websites and builds offline, Dash-compatible docsets.

## Features

- Crawl and extract documentation content from websites
- Transform pages into structured docset entries
- Build offline docsets for fast local lookup

## Requirements

- [Bun](https://bun.sh)

## Install Dependencies

```bash
bun install
```

## Supported Crawlers

Crawler entrypoints live in `bin/`.

- `bin/bun/latest/index.ts` - Bun docs crawler
- `bin/tailwindcss/4.2/index.ts` - Tailwind CSS v4.2 docs crawler

## Run a Crawler

Run a crawler directly by entrypoint path:

```bash
bun run bin/<source>/<version>/index.ts
```

Examples:

```bash
bun run bin/bun/latest/index.ts
bun run bin/tailwindcss/4.2/index.ts
```

## Output

Generated docsets and artifacts are written under `dist/`.

## Add a New Crawler

Create a new entrypoint under `bin/<source>/<version>/index.ts` and run it with `bun run`.

## Project Scripts

The npm-style scripts in `package.json` are not the primary workflow for crawler execution. Prefer running crawler entrypoints from `bin/` directly.

## Type Check

```bash
bun run typecheck
```

## Test

```bash
bun run test
```
