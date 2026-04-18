import { mkdir, rm } from "node:fs/promises";
import { join } from "path";
import { Glob, pathToFileURL, write } from "bun";
import { Database } from "bun:sqlite";
import { documentFrom } from "./utils";
import type { VirtualDocument } from "very-happy-dom";

type DocsetMeta = {
  id: string;
  name: string;
  family: string;
};

type EntryType =
  | "Annotation"
  | "Attribute"
  | "Binding"
  | "Builtin"
  | "Callback"
  | "Category"
  | "Class"
  | "Command"
  | "Component"
  | "Constant"
  | "Constructor"
  | "Define"
  | "Delegate"
  | "Diagram"
  | "Directive"
  | "Element"
  | "Entry"
  | "Enum"
  | "Environment"
  | "Error"
  | "Event"
  | "Exception"
  | "Extension"
  | "Field"
  | "File"
  | "Filter"
  | "Framework"
  | "Function"
  | "Global"
  | "Guide"
  | "Hook"
  | "Instance"
  | "Instruction"
  | "Interface"
  | "Keyword"
  | "Library"
  | "Literal"
  | "Macro"
  | "Method"
  | "Mixin"
  | "Modifier"
  | "Module"
  | "Namespace"
  | "Notation"
  | "Object"
  | "Operator"
  | "Option"
  | "Package"
  | "Parameter"
  | "Plugin"
  | "Procedure"
  | "Property"
  | "Protocol"
  | "Provider"
  | "Provisioner"
  | "Query"
  | "Record"
  | "Resource"
  | "Sample"
  | "Section"
  | "Service"
  | "Setting"
  | "Shortcut"
  | "Statement"
  | "Struct"
  | "Style"
  | "Subroutine"
  | "Tag"
  | "Test"
  | "Trait"
  | "Type"
  | "Union"
  | "Value"
  | "VariableWord";

function metaFrom(output: string, input: DocsetMeta | string) {
  const id = typeof input === "string" ? input : input.id;
  const name = typeof input === "string" ? input : input.name;
  const family = typeof input === "string" ? input : input.family;
  const docs = join(output, `${name}.docset`, "Contents/Resources/Documents");

  return { id, name, family, docs };
}

export function indexAt(output = "dist", meta: DocsetMeta | string) {
  const { name, docs } = metaFrom(output, meta);

  const sql = new Database(
    join(output, `${name}.docset`, "Contents/Resources/docSet.dsidx"),
    { create: true },
  );

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

  return {
    insert(name: string, type: EntryType, path: string) {
      prepared.run(name, type, path);
    },
    async glob(
      pattern: string,
      callback: (document: VirtualDocument, path: string) => void,
    ) {
      await Array.fromAsync(new Glob(pattern).scan(docs), async (path) => {
        const file = join(process.cwd(), docs, path);
        const document = await documentFrom(pathToFileURL(file));

        callback(document, path);

        await write(file, document.documentElement!.outerHTML);
      });
    },
  };
}

export async function scaffoldAt(output = "dist", meta: DocsetMeta | string) {
  const { docs, id, name, family } = metaFrom(output, meta);

  await rm(output, { recursive: true, force: true });

  await mkdir(docs, {
    recursive: true,
  });

  await write(
    join(output, `${name}.docset`, "Contents/Info.plist"),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleIdentifier</key>
  <string>${id}</string>
	<key>CFBundleName</key>
  <string>${name}</string>
	<key>DocSetPlatformFamily</key>
  <string>${family}</string>
	<key>isDashDocset</key>
	<true/>
</dict>
</plist>`,
  );

  return docs;
}
