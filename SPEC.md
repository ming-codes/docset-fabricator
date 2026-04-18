# Dashset - Documentation Site Archiver

## Project Overview

**Dashset** is a CLI tool that crawls and archives documentation websites locally. It fetches documentation pages, extracts main content, downloads external assets (stylesheets, images, fonts), and produces a static offline copy suitable for local browsing.

## Core Functionality

1. **Crawl Documentation Pages**
   - Fetches a starting URL (typically a docs homepage)
   - Extracts navigation links from a specified navbar selector (default: `nav`)
   - Resolves relative URLs to absolute URLs

2. **Archive Documentation**
   - Downloads each documentation page as static HTML
   - Extracts main content (h1-h6 headings and their lowest common ancestor)
   - Removes navigation/anchor elements
   - Strips `<script>` tags for static rendering

3. **Asset Management**
   - Rewrites stylesheet `<link>` hrefs to relative paths
   - Downloads external CSS, fonts, and images
   - Preserves asset directory structure

4. **DOM Processing**
   - Uses `very-happy-dom` for server-side HTML parsing
   - Uses `puppeteer` (likely for JavaScript-rendered sites)

## File Structure

```
src/
├── index.ts      # Main entry point (crawls Tailwind CSS docs as demo)
├── crawl.ts      # Navbar link extraction
├── archive.ts    # Page archiving and HTML processing
├── utils.ts      # Fetch and parse HTML from URL
└── bk.ts         # Backup/legacy implementation
```

## Usage

```bash
bun run src/index.ts
```

The default entry point archives `https://tailwindcss.com/docs/` to `./output/`.

## Dependencies

- **Bun**: Runtime
- **puppeteer**: Browser automation for JS-rendered content
- **very-happy-dom**: Lightweight DOM implementation for HTML parsing
- **TypeScript**: Type safety
