import { VirtualElement, Window, type VirtualNode } from "very-happy-dom";
import { parse } from "css-tree";

export async function documentFrom(url: URL) {
  const response = await fetch(url);
  const html = await response.text();
  const window = new Window();

  window.document.body!.innerHTML = html;

  return window.document;
}

export async function stylesheetFrom(url: URL) {
  const response = await fetch(url);
  const source = await response.text();

  return parse(source);
}

type NodeLike = {
  parentNode?: VirtualNode | VirtualElement | null;
};

export function detachVirtualElement(el?: NodeLike | Array<NodeLike> | null) {
  if (el) {
    if (Array.isArray(el)) {
      el.forEach((each) => {
        each.parentNode?.removeChild(each as unknown as VirtualNode);
      });
    } else {
      el.parentNode?.removeChild(el as unknown as VirtualNode);
    }
  }
}
