---
name: create-docset
description: |
  Create Dash-compatible docset archives from web documentation.
  Use when needing to scrape and index documentation sites for offline use,
  including: (1) Creating new docset scrapers for documentation sites like the tailwindcss/4.2 example,
  (2) Crawling and archiving web documentation, (3) Building searchable documentation indices,
  (4) Extracting content and metadata from HTML docs for indexing.
---

# Docset Scraper

## Quick Start

Create a scraper in `bin/<docset-name>/<version>/index.ts`:

```typescript
import { indexAt, scaffoldAt } from "@/docset";
import { archive } from "@/archive";
import { fromNavbar } from "@/crawl";
import { detachVirtualElement, documentFrom } from "@/utils";
import { Glob, pathToFileURL, write } from "bun";
import { join } from "path";
import type { VirtualDocument } from "very-happy-dom";

async function processWebResources(output: string, name: string, root: string) {
  const docs = await scaffoldAt(output, name);

  const input = new URL(root);
  const links = await fromNavbar(new URL(input.href));

  await archive(
    links.filter((href) => href.pathname.startsWith(input.pathname)),
    docs,
  );

  // Post-process HTML files as needed
  await Array.fromAsync(new Glob("**/*.html").scan(docs), async (path) => {
    const file = join(process.cwd(), docs, path);
    const document = await documentFrom(pathToFileURL(file));
    // Modify document, extract data, etc.
    await write(file, document.documentElement!.outerHTML);
  });
}

function processAsReference(document: VirtualDocument, path: string) {
  // Extract headings and index them
  const headings = document.querySelectorAll("h1,h2,h3,h4,h5,h6");
  const h1 = headings.find((heading) => heading.tagName.toLowerCase() === "h1")!;

  index.insert(h1.textContent, "Property", path);

  // Extract and index table rows, code blocks, etc.
}

function processAsGuide(document: VirtualDocument, path: string) {
  const headings = document.querySelectorAll("h1,h2,h3,h4,h5,h6");
  const h1 = headings.find((heading) => heading.tagName.toLowerCase() === "h1")!;

  index.insert(h1.textContent, "Guide", path);
}

await processWebResources("dist", "docset-name", "https://docs.example.com/");

const index = indexAt("dist", "docset-name");

await index.glob("**/*.html", (document, path) => {
  // Determine document type and process accordingly
  const section = document.querySelector("[data-section]")?.textContent ?? "";

  if (/* guide sections */) {
    processAsGuide(document, path);
  } else {
    processAsReference(document, path);
  }
});
```

## Key Functions

### `scaffoldAt(output, meta)`

Creates the docset directory structure. Returns the Documents folder path.

- `output`: Output directory (e.g., "dist")
- `meta`: Object `{ id, name, family }` or just a string (used as all three)

### `indexAt(output, meta)`

Creates a searchable index. Returns an indexer with:

- `insert(name, type, path)`: Add entry to index
- `glob(pattern, callback)`: Iterate over HTML files

### `archive(urls, docs)`

Downloads all URLs to the docs folder.

### `fromNavbar(url)`

Crawls a documentation site starting from the navbar links.

## Entry Types

Standard Dash entry types include: `Property`, `Value`, `Guide`, `Class`, `Function`, `Method`, `Type`, `Variable`, `Constant`, `Element`, `Attribute`, `Hook`, `Component`, `Directive`, `Interface`, `Enum`, `Struct`, `Section`

## Post-Processing

Common patterns:

- **Expand collapsed content**: Remove `hidden` attributes, click "Show More" buttons
- **Extract IDs**: Set `id` attributes on elements for anchor linking
- **Clean content**: Replace HTML entities (`&lt;`, `&gt;`)