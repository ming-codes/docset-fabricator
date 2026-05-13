import { describe, expect, it } from "bun:test";
import { asyncFlatMapUniqueUrls, hashFileName, hashURL } from "./utils";

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

describe("hashFileName", () => {
  it("should end with same file extension when given file extension", () => {
    expect(hashFileName("/_next/static/style.css")).toEndWith(".css");
  });

  it("should end with no file extension when given no extension", () => {
    expect(hashFileName("/_next/static/image")).not.toContain(".");
  });
});

