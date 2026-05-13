import { indexAt, scaffoldAt } from "@/docset";
import { archive } from "@/archive";
import { fromNavbar } from "@/crawl";
import { detachElement, documentFrom } from "@/utils";
import { Glob, pathToFileURL, write } from "bun";
import { join } from "path";
import type { Document } from "happy-dom";

async function processWebResources(output: string, name: string, root: string) {
  const docs = await scaffoldAt(output, name);

  const input = new URL(root);

  const links = await fromNavbar(new URL(input.href), "#navigation-items");

  await archive(
    links.filter((href) => href.pathname.startsWith(input.pathname)).slice(-2),
    docs,
  );

  // await Array.fromAsync(new Glob("**/*.html").scan(docs), async (path) => {
  //   const file = join(process.cwd(), docs, path);
  //   const document = await documentFrom(pathToFileURL(file));
  //
  //   const tr = document.querySelectorAll("#quick-reference tbody tr");
  //   const tbody = document.querySelectorAll("#quick-reference tbody");
  //
  //   const more = document
  //     .querySelectorAll("#quick-reference button")
  //     .find((btn) => btn.textContent.trim().toLowerCase() === "show more");
  //
  //   detachVirtualElement(more?.parentNode);
  //
  //   tbody.forEach((body) => {
  //     body.removeAttribute("hidden");
  //   });
  //
  //   tr.forEach((row) => {
  //     const [cls] = row.querySelectorAll("td").map((cell) => {
  //       return cell.textContent
  //         .trim()
  //         .replaceAll("&lt;", "<")
  //         .replaceAll("&gt;", ">");
  //     }) as [string, string];
  //
  //     row.setAttribute("id", cls);
  //   });
  //
  //   await write(file, document.documentElement!.outerHTML);
  // });
}

// function processAsReference(document: VirtualDocument, path: string) {
//   const headings = document.querySelectorAll("h1,h2,h3,h4,h5,h6");
//   const h1 = headings.find(
//     (heading) => heading.tagName.toLowerCase() === "h1",
//   )!;
//   const tr = document.querySelectorAll("#quick-reference tbody tr");
//
//   index.insert(h1.textContent, "Property", path);
//
//   tr.forEach((row) => {
//     const [cls, styl] = row.querySelectorAll("td").map((cell) => {
//       return cell.textContent
//         .trim()
//         .replaceAll("&lt;", "<")
//         .replaceAll("&gt;", ">");
//     }) as [string, string];
//
//     index.insert(cls, "Value", `${path}#${encodeURIComponent(cls)}`);
//     index.insert(styl, "Value", `${path}#${encodeURIComponent(cls)}`);
//   });
// }

// function processAsGuide(document: Document, path: string) {
//   const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"));
//   const h1 = headings.find(
//     (heading) => heading.tagName.toLowerCase() === "h1",
//   )!;
//   const tr = document.querySelectorAll("#quick-reference tbody tr");
//
//   docs.insert(h1.textContent, "Guide", path);
//
//   tr.forEach((row) => {
//     const [cls, styl] = row.querySelectorAll("td").map((cell) => {
//       return cell.textContent
//         .trim()
//         .replaceAll("&lt;", "<")
//         .replaceAll("&gt;", ">");
//     }) as [string, string];
//
//     index.insert(cls, "Value", `${path}#${encodeURIComponent(cls)}`);
//     index.insert(styl, "Value", `${path}#${encodeURIComponent(cls)}`);
//   });
// }

await processWebResources("dist", "bun", "https://bun.com/docs");

// const index = indexAt("dist", "tailwindcss");
//
// await index.glob("**/*.html", (document, path) => {
//   const section = document.querySelector("[data-section]")?.textContent ?? "";
//
//   if (
//     ["getting started", "core concepts"].includes(section.trim().toLowerCase())
//   ) {
//     processAsGuide(document, path);
//   } else {
//     processAsReference(document, path);
//   }
// });
