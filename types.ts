declare module "very-happy-dom" {
  interface VirtualElement {
    tagName: string;
    innerHTML: string;
    outerHTML: string;
    textContent: string;
    parentNode: VirtualNode | null;
    removeChild(node: VirtualNode | VirtualElement | null): void;
  }

  interface VirtualNode {
    parentNode: VirtualNode | null;
    removeChild(node: VirtualNode | VirtualElement | null): void;
  }
}
