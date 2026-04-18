import { dirname, join } from "path";
import { documentFrom } from "@/utils";

export async function fromNavbar(
  baseUrl: URL,
  selector = "nav",
): Promise<Array<URL>> {
  const document = await documentFrom(baseUrl);

  return document
    .querySelectorAll(`${selector} a`)
    .map((a) => a.getAttribute("href"))
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => {
      if (entry.startsWith("http")) {
        return new URL(entry);
      }
      if (entry.startsWith("/")) {
        return new URL(entry, baseUrl.origin);
      }

      return new URL(join(dirname(baseUrl.pathname), entry), baseUrl.origin);
    });
}
