import { detachVirtualElement, documentFrom, stylesheetFrom } from "@/utils";
import { generate, walk, type CssNode } from "css-tree";
import { dirname, join, relative } from "path";
import {
  VirtualDocument,
  type VirtualElement,
  type VirtualNode,
} from "very-happy-dom";
import { fileURLToPath, pathToFileURL, write } from "bun";
import yoctocolors from "yoctocolors";

type VisitorEmitter = (
  type: ResourceType,
  from: URL,
  to: URL,
  link: string,
  node?:
    | VirtualDocument
    | VirtualElement
    | Array<VirtualElement>
    | CssNode
    | Array<CssNode>,
) => void;
type VisitorOptions = {
  from: URL;
  to: URL;
  link: string;
  emit: VisitorEmitter;
  rewrite: ResourcePathRewrite;
};
type Visitor = (options: VisitorOptions) => Promise<void> | void;
type ResourceType =
  | "document"
  | "image"
  | "javascript"
  | "stylesheet"
  | "font"
  | "anchor";
type ResourcePathRewrite = (
  href: string,
  location: { pathname: string; origin: string },
) => [URL, URL, string];

export async function archive(root: Array<URL>, output = "./dist") {
  const loop = async (visitors: {
    [key in ResourceType]: Visitor;
  }) => {
    const resources = new Map<
      string,
      {
        type: ResourceType;
        from: URL;
        to: URL;
        link: string;
        node?:
        | VirtualDocument
        | VirtualElement
        | Array<VirtualElement>
        | CssNode
        | Array<CssNode>;
      }
    >(
      root.map((url) => {
        return [
          url.href,
          {
            type: "document",
            from: url,
            to: pathToFileURL(join(process.cwd(), output, url.pathname)),
            link: ".",
          },
        ];
      }),
    );
    const emit: VisitorEmitter = (type, from, to, link, node) => {
      resources.set(from.href, { type, from, to, link, node });
    };
    const rewrite: ResourcePathRewrite = (href, location) => {
      const toRoot = relative(dirname(location.pathname), "/");

      if (href.startsWith("http")) {
        // http://external.com/sheet.css => /__externals__/external.com/sheet.css
        const from = new URL(href);
        const to = pathToFileURL(
          join(
            process.cwd(),
            output,
            "__externals__",
            from.host,
            from.pathname,
          ),
        );
        // TODO not handling .search

        return [from, to, ""];
      } else if (href.startsWith("/")) {
        const from = new URL(href, location.origin);
        const to = pathToFileURL(join(process.cwd(), output, href));
        const link = join(toRoot, from.pathname);

        return [from, to, link];
      } else {
        const from = new URL(
          join(dirname(location.pathname), href),
          location.origin,
        );
        const to = pathToFileURL(join(process.cwd(), output, from.pathname));
        // const link = relative(dirname(location.pathname), href);
        const link = join(toRoot, from.pathname);

        return [from, to, link];
      }
    };

    while (resources.size) {
      const entries = Array.from(resources.values());

      resources.clear();

      await Promise.all(
        entries.map(async ({ type, from, ...others }) => {
          console.log(
            yoctocolors.bold("Archiving"),
            yoctocolors.italic(type),
            from.href,
          );
          await visitors[type]({ emit, rewrite, from, ...others });
        }),
      );
    }
  };

  await loop({
    async document({ emit, from, rewrite }) {
      const document = await documentFrom(from);
      const location = document.location;
      const pathname = `${from.pathname}.html`;
      const images = document.querySelectorAll("img[src]");
      const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
      const anchors = document.querySelectorAll("a[href]");
      const javascript = [
        ...document.querySelectorAll("script"),
        ...document.querySelectorAll('link[as="font"]'),
        ...document.querySelectorAll('link[as="script"]'),
      ];

      location.href = from.href;
      location.protocol = from.protocol;
      location.host = from.host;
      location.hostname = from.hostname;
      location.port = from.port;
      location.pathname = from.pathname;
      location.search = from.search;
      location.hash = from.hash;
      location.origin = from.origin;

      stylesheets.forEach((sheet) => {
        const href = sheet.getAttribute("href");

        if (href) {
          const [from, to, link] = rewrite(href, location);

          sheet.setAttribute("href", link);

          emit("stylesheet", from, to, link);
        }
      });

      detachVirtualElement(javascript);

      processMain(document);

      await write(join(output, pathname), document.documentElement!.outerHTML);
    },
    async stylesheet({ from: source, emit, to, rewrite }) {
      const ast = await stylesheetFrom(source);
      const fonts: Array<Promise<unknown>> = [];

      walk(ast, (node, item, list) => {
        if (node.type === "Url" && !node.value.startsWith("data:")) {
          const [from, to, link] = rewrite(node.value, source);

          if (link.endsWith(".png")) {
            node.value = link;

            emit("image", from, to, link, node);
          }
          if (from.href.endsWith("woff2")) {
            fonts.push(
              fetch(from)
                .then((resp) => resp.arrayBuffer())
                .then((buf) => {
                  const base64 = Buffer.from(buf).toString("base64");
                  const dataUrl = `data:font/woff2;charset=utf-8;base64,${base64}`;

                  node.value = dataUrl;
                }),
            );
          }
        }
      });

      await Promise.all(fonts);

      await write(fileURLToPath(to), generate(ast));
    },
    javascript({ }) { },
    image({ }) { },
    anchor({ }) { },
    font({ from: source }) {
      console.log("font", source);
    },
  });
}

function processMain(document: VirtualDocument): void {
  const main = findLowestCommonAncestor(
    document.querySelectorAll(
      "h1,h2,h3,h4,h5,h6",
    ) as unknown as Array<VirtualElement>,
  );
  const anchor = findAnchor(main);

  detachVirtualElement(main);
  detachVirtualElement(anchor);
  document.body?.appendChild(main);
}

function findLowestCommonAncestor(nodes: Array<VirtualElement>): VirtualNode {
  const chain: Array<VirtualNode> = [];

  nodes.forEach((node) => {
    for (
      let cursor: VirtualNode | null = node.parentNode;
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

  return chain.shift() as VirtualNode;
}

function findAnchor(node: VirtualNode): VirtualNode | null {
  for (
    let cursor: VirtualNode | null = node;
    cursor;
    cursor = cursor.parentNode
  ) {
    const parent = cursor.parentNode;
    if (parent && "tagName" in parent && parent.tagName === "BODY") {
      return parent;
    }
  }

  return null;
}
