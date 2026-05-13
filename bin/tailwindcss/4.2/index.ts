import { Docset } from "@/docset";
import { guid, metaFrom } from "@/utils";
import { findAll, type Url } from "css-tree";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const docset = new Docset("tailwindcss");

await docset.clean();

await docset.scaffold();

// await docset.restore("0");

await docset.crawl(async ({ navbar }) => {
  const links = await navbar(new URL("https://tailwindcss.com/docs/"));

  return links.slice(-2);
});

await docset.documents((document, file) => {
  const url = new URL(document.location.href);

  Array.from(document.querySelectorAll('link[rel="stylesheet"]'), (sheet) => {
    const sheetFilePath = docset.resolveFile(
      join(sheet.getAttribute("href")!, "content.css"),
      file,
    );

    sheet.setAttribute(
      "href",
      decodeURIComponent(relative(dirname(url.href), sheetFilePath.href)),
    );
  });
});

await docset.stylesheets(async (ast, file) => {
  const fontFaceAtRules = findAll(ast, (node) => {
    return node.type === "Atrule" && node.name === "font-face";
  });

  const nodes = fontFaceAtRules.flatMap((ast) => {
    return findAll(ast, (node) => {
      return node.type === "Url" && !node.value.startsWith("data:");
    });
  });

  await Promise.all(
    nodes
      .filter((node): node is Url => node.type === "Url")
      .map(async (node) => {
        const dirPath = fileURLToPath(
          docset.resolveFile(node.value, new URL(dirname(file.href))),
        );
        const meta = await metaFrom(pathToFileURL(join(dirPath, "meta.json")));
        const target = join(dirPath, `content.${meta.extname}`);

        node.value = relative(dirname(fileURLToPath(file)), target);
        // node.value = await base64EncodeFileContent(
        //   pathToFileURL(target),
        //   meta.mimeType,
        // );
      }),
  );
});

await docset.documents((document) => {
  document.querySelectorAll('[rel="preload"], script').forEach((node) => {
    node.remove();
  });

  document.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach((node) => {
    if (!node.id) {
      node.id = `${node.textContent.trim().toLowerCase()}-${guid(document)}`;
    }
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

  if (
    ["getting started", "core concepts"].includes(section.trim().toLowerCase())
  ) {
    docset.prepareSqlIndex((insert) => {
      insert(h1.textContent, "Guide", `${meta.localContentPath}#${h1.id}`);
    });
  } else {
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
