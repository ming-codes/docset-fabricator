import { join } from "path";
import yoctocolors from "yoctocolors";
import { Database } from "bun:sqlite";
import { Document, Element, Location, Node, Window } from "happy-dom";
import { fromNavbar } from "@/crawl";
import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { basename, dirname } from "node:path";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { findAll, parse, generate, type CssNode, type Url } from "css-tree";
import { asyncFlatMapUniqueUrls, documentFrom, metaFrom, normalizeURL } from "./utils";
import type { DocsetMeta, EntryType, FileMeta } from "./types";
import { fileURLToPath, Glob, pathToFileURL, write } from "bun";
import { cp } from "node:fs/promises";

async function parseStylesheet(response: Response) {
  return parse(await response.text());
}

async function parseDocument(response: Response) {
  const html = await response.text();
  const url = new URL(response.url);

  const { document, location } = new Window({
    url: url.href,
    settings: {
      disableCSSFileLoading: true,
      disableComputedStyleRendering: true,
    },
  });

  document.open();
  document.write(html);
  document.close();

  location.href = url.href;
  location.protocol = url.protocol;
  location.host = url.host;
  location.hostname = url.hostname;
  location.port = url.port;
  location.pathname = url.pathname;
  location.search = url.search;
  location.hash = url.hash;

  return document;
}

export class Docset {
  public readonly output: string;
  public readonly id: string;
  public readonly name: string;
  public readonly family: string;

  private isClean = false;
  private db?: Database;

  public constructor(meta: DocsetMeta | string, output = "dist") {
    this.id = typeof meta === "string" ? meta : meta.id;
    this.name = typeof meta === "string" ? meta : meta.name;
    this.family = typeof meta === "string" ? meta : meta.family;

    this.output = join(process.cwd(), output, `${this.name}.docset`);
  }

  public async clean() {
    await rm(this.output, { recursive: true, force: true });

    this.isClean = true;
  }

  public async restore(name?: string) {
    const dir = dirname(this.output);
    const base = basename(this.output);

    console.log("Restore from", join(dir, `${base}.${name}`));

    await cp(join(dir, `${base}.${name}`), this.output, {
      force: true,
      recursive: true,
    });
  }

  // public async backup(name?: string) {
  //   const dir = dirname(this.output);
  //   const base = basename(this.output);
  //   const bkup =
  //
  //   console.log(this.output);
  //   console.log(dir);
  //   console.log(base);
  //   // await cp(this.output, );
  // }

  public async scaffold() {
    if (!this.isClean) {
      throw new Error(
        "Docset is not clean. Please call `.clean()` before scaffolding",
      );
    }

    await mkdir(join(this.output, "Contents/Resources"), {
      recursive: true,
    });

    // this.db = new Database(
    //   join(this.output, "Contents/Resources/docSet.dsidx"),
    //   { create: true },
    // );

    await write(
      join(this.output, "Contents/Info.plist"),
      `<?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
    <plist version="1.0">
    <dict>
    	<key>CFBundleIdentifier</key>
      <string>${this.id}</string>
    	<key>CFBundleName</key>
      <string>${this.name}</string>
    	<key>DocSetPlatformFamily</key>
      <string>${this.family}</string>
    	<key>isDashDocset</key>
    	<true/>
    </dict>
    </plist>`,
    );
  }

  /**
   * Low level API to retrieve paths used by this docset
   */
  public pathFor(type: "documents" | "resources") {
    if (type === "documents") {
      return join(this.output, "Contents/Resources/Documents");
    } else if (type === "resources") {
      return join(this.output, "Contents/Resources");
    }

    throw new Error(`Unrecognized type: ${type}`);
  }

  private extnameForMimeType(type: string | null): string {
    if (!type) {
      return "txt";
    }

    if (type.startsWith("text/html")) {
      return "html";
    }

    if (type.startsWith("text/css")) {
      return "css";
    }

    if (type.startsWith("font/woff2")) {
      return "woff2";
    }

    if (type.startsWith("image/jpeg")) {
      return "jpeg";
    }

    throw new Error(type);
  }

  /**
   * Low level API - resolve local relative path to absolute url
   */
  public resolveFile(href: string, source: URL | Location): URL {
    if (href.startsWith("file://")) {
      return new URL(href);
    } else if (href.startsWith("/")) {
      const documentsPath = this.pathFor("documents");
      const { hostname } = new URL(
        fileURLToPath(new URL(source.href)).replace(documentsPath, "http:/"),
      );

      return pathToFileURL(join(documentsPath, hostname, href));
    }

    return pathToFileURL(join(dirname(source.pathname), href));
  }

  /**
   * Low level API - resolve remote relative path to absolute url
   */
  public resolveURL(href: string, source: URL | Location) {
    if (href.startsWith("http")) {
      return new URL(href);
    }

    if (href.startsWith("/")) {
      return new URL(href, source.origin);
    }

    return new URL(join(source.hostname, dirname(source.pathname), href));
  }

  private async download(url: URL): Promise<void>;
  private async download<T>(
    source: URL,
    parser?: (response: Response) => Promise<T>,
  ): Promise<T>;
  private async download<T>(
    source: URL,
    parser?: (response: Response) => Promise<T>,
  ): Promise<T | undefined> {
    const response = await fetch(source);
    const contentType = response.headers.get("content-type")!;
    const mimeType = contentType.split(";").shift()!.trim();
    const extname = this.extnameForMimeType(contentType);
    const localPath = join(
      ...[
        source.host,
        source.pathname,
        Array.from(source.searchParams.entries()),
      ].flat(10),
    );
    const localContentPath = join(localPath, `content.${extname}`);
    const target = join(this.output, "Contents/Resources/Documents", localPath);
    await mkdir(target, { recursive: true });

    const meta = write(
      join(target, "meta.json"),
      JSON.stringify(
        {
          source: source.href,
          localPath,
          localContentPath,
          contentType,
          mimeType,
          extname,
        },
        null,
        2,
      ),
    );

    if (!response.ok) {
      throw new Error(`Unexpected response ${response.statusText}`);
    }

    console.log(
      yoctocolors.bold("Archiving"),
      yoctocolors.italic(extname),
      source.href,
    );
    console.log("  ", yoctocolors.green(target));

    if (parser) {
      const writable = createWriteStream(join(target, `content.${extname}`));
      const readable = Readable.fromWeb(response.clone().body!);

      await Promise.all([meta, finished(readable.pipe(writable))]);

      return parser(response);
    }

    await finished(
      Readable.fromWeb(response.body!).pipe(
        createWriteStream(join(target, `content.${extname}`)),
      ),
    );
  }

  /**
   * Crawl website for a list of documents to archive
   */
  public async crawl(
    callback: (tools: { navbar: typeof fromNavbar }) => Promise<Array<URL>>,
  ) {
    const links = await callback({
      async navbar(baseUrl: URL, selector = "nav"): Promise<Array<URL>> {
        const document = await documentFrom(baseUrl);

        const anchors = Array.from(
          document.querySelectorAll(`${selector} a[href]`),
          (el) => {
            return el.getAttribute("href");
          },
        );

        return anchors
          .filter((entry): entry is string => typeof entry === "string")
          .map((entry) => {
            if (entry.startsWith("http")) {
              return new URL(entry);
            }
            if (entry.startsWith("/")) {
              return new URL(entry, baseUrl.origin);
            }

            return new URL(
              join(dirname(baseUrl.pathname), entry),
              baseUrl.origin,
            );
          });
      },
    });

    const { stylesheets, images } = await asyncFlatMapUniqueUrls(
      links,
      async (url) => {
        const document = await this.download(url, parseDocument);

        return {
          stylesheets: Array.from(
            document.querySelectorAll('link[rel="stylesheet"]'),
            (sheet) => {
              return normalizeURL(sheet.getAttribute("href") ?? "", url);
            },
          ),
          images: Array.from(document.querySelectorAll("img")).flatMap(
            (node) => {
              const srcset = (
                node.getAttribute("srcset")?.split(",") ?? []
              ).map((str) => str.slice(0, -3));
              const src = node.getAttribute("src");

              return [src, ...srcset]
                .filter((src): src is string => Boolean(src))
                .map((src) => this.resolveURL(src.trim(), url));
            },
          ),
        };
      },
    );

    const fonts = await asyncFlatMapUniqueUrls(stylesheets, async (sheet) => {
      const ast = await this.download(sheet, parseStylesheet);

      const fontFaceAtRules = findAll(ast, (node) => {
        return node.type === "Atrule" && node.name === "font-face";
      });

      const nodes = fontFaceAtRules.map((ast) => {
        return findAll(ast, (node) => {
          return node.type === "Url" && !node.value.startsWith("data:");
        });
      });

      return nodes
        .flat(10)
        .filter((node): node is Url => node.type === "Url")
        .map((node) => normalizeURL(node.value, sheet));
    });

    await Promise.all([
      ...fonts.map(async (url) => {
        await this.download(url);
      }),
      ...images.map(async (url) => {
        await this.download(url);
      }),
    ]);
  }

  /**
   * Glob pattern in documents
   */
  async glob(pattern: string, callback: (files: URL) => void | Promise<void>) {
    const files = await Array.fromAsync(
      new Glob(pattern).scan(this.pathFor("documents")),
    );

    return Promise.all(
      files
        .map((file) => join(this.pathFor("documents"), file))
        .map(pathToFileURL)
        .map(callback),
    );
  }

  /**
   * Hoist the main section up to body level. Clean up the rest.
   *
   * @param selector selector string or callback to grab the main.
   *                 if not provided, uses heuristic find determine
   *                 where it is.
   */
  async main(selector?: string | ((document: Document) => Node)) {
    const use = (el: Element) => {
      const body = el.closest("body")!;
      const root = el.closest("body > *")!;

      root.remove();

      body.appendChild(el);
    };
    const deduce = (document: Document) => {
      const chain: Array<Node> = [];
      const maybeMain = document.querySelector('main, [role="main"], #content');

      if (maybeMain) {
        return maybeMain;
      }

      const nodes = Array.from(
        document.querySelectorAll("h1,h2,h3,h4,h5,h6"),
      ).filter((node) => {
        return !node.closest('nav, [role="navigation"]');
      });

      nodes.forEach((node) => {
        for (
          let cursor: Node | null = node.parentNode;
          cursor;
          cursor = cursor.parentNode
        ) {
          const index = chain.indexOf(cursor);

          if (index > -1) {
            chain.length = index + 1;
          } else {
            chain.push(cursor);
          }
        }
      });

      return chain.shift();
    };

    if (typeof selector === "string") {
      return this.documents((document) => {
        use(document.querySelector(selector) as Element);
      });
    } else if (typeof selector === "function") {
      return this.documents((document) => {
        use(selector(document) as Element);
      });
    } else {
      return this.documents((document) => {
        return use(deduce(document) as Element);
      });
    }
  }

  /**
   * Glob and loop through html files in callback
   */
  async documents(
    callback: (
      doc: Document,
      file: URL,
      meta: FileMeta,
    ) => void | Promise<void>,
  ) {
    return this.glob("**/content.html", async (file) => {
      const [document, meta] = await Promise.all([
        documentFrom(file),

        metaFrom(file),
      ]);

      await callback(document, file, meta);

      await write(file, document.documentElement!.outerHTML);
    });
  }

  /**
   * Glob and loop through css files in callback
   */
  async stylesheets(
    callback: (doc: CssNode, file: URL, meta: FileMeta) => void | Promise<void>,
  ) {
    return this.glob("**/content.css", async (file) => {
      const response = await fetch(file);
      const css = await response.text();

      const cssnode = parse(css);

      await callback(cssnode, file, await metaFrom(file));

      await write(file, generate(cssnode));
    });
  }

  prepareSqlIndex(
    callback: (
      insert: (name: string, type: EntryType, path: string) => void,
    ) => void,
  ) {
    const sql = new Database(join(this.pathFor("resources"), "docSet.dsidx"), {
      create: true,
    });

    sql.run(`
        CREATE TABLE IF NOT EXISTS searchIndex (
          id INTEGER PRIMARY KEY,
          name TEXT,
          type TEXT,
          path TEXT
        );
      `);
    sql.run(`
        CREATE UNIQUE INDEX IF NOT EXISTS anchor ON searchIndex (name, type, path);
      `);

    const prepared = sql.prepare(
      `INSERT OR IGNORE INTO searchIndex(name, type, path) VALUES (?, ?, ?)`,
    );

    callback((name: string, type: EntryType, path: string) => {
      prepared.run(name, type, path);
    });
  }
}
