import { Docset } from "@/docset";
import { guid, metaFrom } from "@/utils";

const docset = new Docset("tailwindcss");

await docset.clean();

await docset.scaffold();

// await docset.restore("0");

await docset.crawl(async ({ navbar }) => {
  const links = await navbar(new URL("https://tailwindcss.com/docs/"));

  return links.filter((link) => {
    return link.pathname.startsWith("/docs");
  });
});

await docset.documents((document) => {
  document
    .querySelectorAll('[rel="preload"], script, [rel="manifest"]')
    .forEach((node) => {
      node.remove();
    });

  document.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach((node) => {
    if (!node.id) {
      node.id = `${node.textContent.trim().toLowerCase()}-${guid(document)}`;
    }

    const anchor = document.createElement("a");

    anchor.setAttribute("name", `//apple_ref/cpp/Example/stroke-width`);
    anchor.setAttribute("class", "dashAnchor");
  });

  document.querySelectorAll("#quick-reference tbody tr").forEach((node) => {
    if (!node.id) {
      node.id = `${node.querySelector("td")!.textContent.trim().toLowerCase()}-${guid(document)}`;
    }
  });

  document.querySelectorAll("#quick-reference tbody").forEach((body) => {
    body.removeAttribute("hidden");
  });
});

await docset.documents((document, _file, meta) => {
  const section = document.querySelector("[data-section]")?.textContent ?? "";
  const h1 = document.querySelector("h1")!;

  document.documentElement.insertBefore(
    document.createComment(`Online page at ${meta.source}`),
    document.head,
  );

  console.log("Indexing...");

  if (
    ["getting started", "core concepts"].includes(section.trim().toLowerCase())
  ) {
    docset.prepareSqlIndex((insert) => {
      insert(h1.textContent, "Guide", `${meta.localContentPath}#${h1.id}`);
    });
  } else {
    const ref = document.querySelector("#quick-reference")!;

    if (!ref) {
      return;
    }

    docset.toc(ref, "Section", "Quick Reference");
    docset.toc(document.querySelector("#examples")!, "Section", "Examples");

    document.querySelectorAll("h3").forEach((node) => {
      docset.toc(node, "Guide");
    });

    docset.prepareSqlIndex((insert) => {
      const tr = document.querySelectorAll("#quick-reference tbody tr");

      insert(h1.textContent, "Property", `${meta.localContentPath}#${h1.id}`);

      tr.forEach((row) => {
        const [cls, styl] = Array.from(row.querySelectorAll("td"), (cell) => {
          return cell.textContent
            .trim()
            .replaceAll("&lt;", "<")
            .replaceAll("&gt;", ">");
        }) as [string, string];

        insert(
          cls,
          "Value",
          `${meta.localContentPath}#${encodeURIComponent(row.id)}`,
        );
        insert(
          styl,
          "Value",
          `${meta.localContentPath}#${encodeURIComponent(row.id)}`,
        );
      });
    });
  }
});

await docset.main();
