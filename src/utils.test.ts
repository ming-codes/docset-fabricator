import { describe, expect, it } from "bun:test";
import { asyncFlatMapUniqueUrls, hashFileName, hashURL, parseDocument, parseStylesheet } from "./utils";

describe("hashURL", () => {
  const source = { origin: "https://example.com", pathname: "/docs/a/b/c" };

  it("/_next/static/style.css?more=params", () => {
    expect(hashURL("/_next/static/style.css?more=params", source)).toEndWith(
      ".css",
    );
  });

  it("../static/icon.svg?more=params", () => {
    expect(hashURL("../static/icon.svg?more=params", source)).toEndWith(".svg");
  });

  it("./static/icon.svg?more=params", () => {
    expect(hashURL("./static/icon.png?more=params", source)).toEndWith(".png");
  });
});

describe("asyncFlatMapUniqueUrls", () => {
  it("should return deduplicated array when callback returns URLs", async () => {
    const urls = [new URL("https://example.com/a"), new URL("https://example.com/b")];
    const result = await asyncFlatMapUniqueUrls(urls, async (url) => url);
    expect(result).toEqual(urls);
    expect(result).toHaveLength(2);
  });

  it("should deduplicate URLs with the same href", async () => {
    const urls = [new URL("https://example.com/a"), new URL("https://example.com/a")];
    const result = await asyncFlatMapUniqueUrls(urls, async (url) => url);
    expect(result).toHaveLength(1);
    expect(result[0]!.href).toBe("https://example.com/a");
  });

  it("should flatten arrays from callback", async () => {
    const urls = [new URL("https://example.com")];
    const result = await asyncFlatMapUniqueUrls(urls, async () => [
      new URL("https://example.com/x"),
      new URL("https://example.com/y"),
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]!.href).toBe("https://example.com/x");
    expect(result[1]!.href).toBe("https://example.com/y");
  });

  it("should return record when callback returns record", async () => {
    const urls = [new URL("https://example.com")];
    const result = await asyncFlatMapUniqueUrls(urls, async () => ({
      a: [new URL("https://example.com/a")],
      b: [new URL("https://example.com/b")],
    }));
    expect(result).toEqual({
      a: [new URL("https://example.com/a")],
      b: [new URL("https://example.com/b")],
    });
  });

  it("should deduplicate within record values", async () => {
    const urls = [new URL("https://example.com")];
    const result = await asyncFlatMapUniqueUrls(urls, async () => ({
      a: [new URL("https://example.com/a"), new URL("https://example.com/a")],
    }));
    expect((result as Record<string, Array<URL>>).a).toHaveLength(1);
  });

  it("should aggregate record values from multiple inputs", async () => {
    const urls = [new URL("https://example.com/1"), new URL("https://example.com/2")];
    const result = await asyncFlatMapUniqueUrls(urls, async (url) => ({
      a: [new URL(url.href + "/a")],
    }));
    expect((result as Record<string, Array<URL>>).a).toHaveLength(2);
  });

  it("should handle mixed URL and Array returns across inputs (array mode)", async () => {
    const urls = [new URL("https://example.com/1"), new URL("https://example.com/2")];
    const result = await asyncFlatMapUniqueUrls(urls, async (url) => {
      if (url.pathname === "/1") return url;
      return [url];
    });
    expect(result).toHaveLength(2);
  });

  it("should return empty record for empty input", async () => {
    const result = await asyncFlatMapUniqueUrls<Record<string, Array<URL>>>([], async () => {
      return {};
    });
    expect(result).toEqual({});
  });
});

describe("parseStylesheet", () => {
  it("should parse css text into a CssNode AST", async () => {
    const response = new Response("body { color: red; }", {
      headers: { "Content-Type": "text/css" },
    });
    const ast = await parseStylesheet(response);
    expect(ast.type).toBe("StyleSheet");
  });

  it("should parse an empty stylesheet", async () => {
    const response = new Response("", {
      headers: { "Content-Type": "text/css" },
    });
    const ast = await parseStylesheet(response);
    expect(ast.type).toBe("StyleSheet");
  });

  it("should parse @font-face rules", async () => {
    const css = `@font-face { font-family: "Test"; src: url("/fonts/test.woff2"); }`;
    const response = new Response(css, {
      headers: { "Content-Type": "text/css" },
    });
    const ast = await parseStylesheet(response);
    expect(ast.type).toBe("StyleSheet");
  });
});

function responseWithUrl(body: string, url: string): Response {
  const response = new Response(body, { headers: { "Content-Type": "text/html" } });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

describe("parseDocument", () => {
  it("should return a document with the parsed HTML", async () => {
    const doc = await parseDocument(
      responseWithUrl(
        `<html><head></head><body><h1>Hello</h1></body></html>`,
        "https://example.com/page",
      ),
    );
    expect(doc.querySelector("h1")?.textContent).toBe("Hello");
  });

  it("should set location from the response URL", async () => {
    const doc = await parseDocument(
      responseWithUrl(
        `<html><body></body></html>`,
        "https://example.com/docs/page?q=1#section",
      ),
    );
    expect(doc.location.hostname).toBe("example.com");
    expect(doc.location.pathname).toBe("/docs/page");
    expect(doc.location.search).toBe("?q=1");
    expect(doc.location.hash).toBe("#section");
  });

  it("should expose querySelectorAll on the returned document", async () => {
    const doc = await parseDocument(
      responseWithUrl(
        `<html><body><a href="/a">A</a><a href="/b">B</a></body></html>`,
        "https://example.com/",
      ),
    );
    const links = Array.from(doc.querySelectorAll("a"));
    expect(links).toHaveLength(2);
    expect(links[0]?.getAttribute("href")).toBe("/a");
    expect(links[1]?.getAttribute("href")).toBe("/b");
  });
});

describe("hashFileName", () => {
  it("should end with same file extension when given file extension", () => {
    expect(hashFileName("/_next/static/style.css")).toEndWith(".css");
  });

  it("should end with no file extension when given no extension", () => {
    expect(hashFileName("/_next/static/image")).not.toContain(".");
  });
});

