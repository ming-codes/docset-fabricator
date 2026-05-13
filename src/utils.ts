import { Window } from "happy-dom";
import { createHash } from "crypto";
import { basename, dirname, extname, join } from "path";
import { fileURLToPath, pathToFileURL } from "bun";

export type Source = { origin: string; pathname: string };

const guidTracker = new WeakMap<any, number>();

export function guid(ref: any): number {
  if (guidTracker.has(ref)) {
    const ret = guidTracker.get(ref)! + 1;

    guidTracker.set(ref, ret);

    return ret;
  }

  guidTracker.set(ref, 0);

  return 0;
}

export function normalizeURL(url: string, source: Source) {
  if (url.startsWith("/")) {
    return new URL(url, source.origin);
  } else if (url.startsWith("https://") || url.startsWith("http://")) {
    return new URL(url);
  } else {
    return new URL(join(dirname(source.pathname), url), source.origin);
  }
}

export function hashURL(url: string, source: Source): string {
  const fn = createHash("sha256");
  const from = normalizeURL(url, source);
  const ext = extname(from.pathname);

  return `${fn.update(from.href).digest("base64url")}${ext}`;
}

export function hashFileName(str: string): string {
  if (str) {
    return (
      createHash("sha256")
        .update(`${dirname(str)}${basename(str, extname(str))}`)
        .digest("base64url") + extname(str)
    );
  }

  return "";
}

export async function metaFrom(url: URL) {
  const dir = dirname(fileURLToPath(url));

  const response = await fetch(pathToFileURL(join(dir, "meta.json")));

  const json = await response.json();

  return json as {
    source: string;
    contentType: string;
    localPath: string;
    localContentPath: string;
    mimeType: string;
    extname: string;
  };
}

export async function asyncFlatMapUniqueUrls(
  urls: Array<URL>,
  callback: (url: URL) => Promise<URL | Array<URL>>,
): Promise<Array<URL>>;
export async function asyncFlatMapUniqueUrls<
  T extends Record<string, Array<URL>>,
>(
  urls: Array<URL>,
  callback: (url: URL) => Promise<T>,
): Promise<T>;
export async function asyncFlatMapUniqueUrls(
  urls: Array<URL>,
  callback: (
    url: URL,
  ) => Promise<URL | Array<URL> | Record<string, Array<URL>>>,
): Promise<Array<URL> | Record<string, Array<URL>>> {
  const array: Array<URL> = [];
  const record: Record<string, Array<URL>> = {};
  const compress = (urls: Array<URL>) => {
    return Array.from(
      new Set(urls.map(({ href }) => href).filter(Boolean)),
      (href) => new URL(href),
    );
  };

  await Promise.all(
    urls.map(async (url) => {
      const mapped = await callback(url);

      if (mapped instanceof URL) {
        array.push(mapped);
      } else if (Array.isArray(mapped)) {
        array.push(...mapped);
      } else {
        for (let [key, value] of Object.entries(mapped)) {
          (record[key] ?? (record[key] = [])).push(...value);
        }
      }
    }),
  );

  if (array.length) {
    return compress(array);
  }

  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => {
      return [key, compress(value)];
    }),
  );
}

export async function documentFrom(url: URL) {
  const response = await fetch(url);
  const html = await response.text();

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




