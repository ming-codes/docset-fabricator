import { indexAt, scaffoldAt } from "./src/docset";
import { archive } from "./src/archive";
import { fromNavbar } from "./src/crawl";
import { detachVirtualElement, documentFrom } from "./src/utils";
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

  await Array.fromAsync(new Glob("**/*.html").scan(docs), async (path) => {
    const file = join(process.cwd(), docs, path);
    const document = await documentFrom(pathToFileURL(file));

    const tr = document.querySelectorAll("#quick-reference tbody tr");
    const tbody = document.querySelectorAll("#quick-reference tbody");

    const more = document
      .querySelectorAll("#quick-reference button")
      .find((btn) => btn.textContent.trim().toLowerCase() === "show more");

    detachVirtualElement(more?.parentNode);

    tbody.forEach((body) => {
      body.removeAttribute("hidden");
    });

    tr.forEach((row) => {
      const [cls, styl] = row.querySelectorAll("td").map((cell) => {
        return cell.textContent
          .trim()
          .replaceAll("&lt;", "<")
          .replaceAll("&gt;", ">");
      }) as [string, string];

      row.setAttribute("id", cls);
    });

    await write(file, document.documentElement!.outerHTML);
  });
}

function processAsReference(document: VirtualDocument, path: string) {
  const headings = document.querySelectorAll("h1,h2,h3,h4,h5,h6");
  const h1 = headings.find(
    (heading) => heading.tagName.toLowerCase() === "h1",
  )!;
  const tr = document.querySelectorAll("#quick-reference tbody tr");

  index.insert(h1.textContent, "Property", path);

  tr.forEach((row) => {
    const [cls, styl] = row.querySelectorAll("td").map((cell) => {
      return cell.textContent
        .trim()
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">");
    }) as [string, string];

    index.insert(cls, "Value", `${path}#${encodeURIComponent(cls)}`);
    index.insert(styl, "Value", `${path}#${encodeURIComponent(cls)}`);
  });
}

function processAsGuide(document: VirtualDocument, path: string) {
  const headings = document.querySelectorAll("h1,h2,h3,h4,h5,h6");
  const h1 = headings.find(
    (heading) => heading.tagName.toLowerCase() === "h1",
  )!;
  // const tr = document.querySelectorAll("#quick-reference tbody tr");

  index.insert(h1.textContent, "Guide", path);

  // tr.forEach((row) => {
  //   const [cls, styl] = row.querySelectorAll("td").map((cell) => {
  //     return cell.textContent
  //       .trim()
  //       .replaceAll("&lt;", "<")
  //       .replaceAll("&gt;", ">");
  //   }) as [string, string];
  //
  //   index.insert(cls, "Value", `${path}#${encodeURIComponent(cls)}`);
  //   index.insert(styl, "Value", `${path}#${encodeURIComponent(cls)}`);
  // });
}

await processWebResources(
  "dist",
  "tailwindcss",
  "https://tailwindcss.com/docs/",
);

const index = indexAt("dist", "tailwindcss");

await index.glob("**/*.html", (document, path) => {
  const section = document.querySelector("[data-section]")?.textContent ?? "";

  if (
    ["getting started", "core concepts"].includes(section.trim().toLowerCase())
  ) {
    processAsGuide(document, path);
  } else {
    processAsReference(document, path);
  }
});
