declare module "very-happy-dom" {
  interface VirtualElement {
    tagName: string;
    innerHTML: string;
    outerHTML: string;
    textContent: string;
    parentNode: VirtualElement;
    removeChild(node: VirtualNode | VirtualElement | null): void;
  }

  interface VirtualNode {
    parentNode: VirtualNode;
    removeChild(node: VirtualNode | VirtualElement | null): void;
  }
}
