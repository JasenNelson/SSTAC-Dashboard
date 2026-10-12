import type { Root } from 'mdast';

type DisplayNode = {
  type: string;
  value?: string;
  children?: DisplayNode[];
  data?: { hName?: string; hProperties?: Record<string, string> };
};

const TABLE_CAPTION = /^Table:\s+(Table\s+[A-Za-z0-9-]+\.\s+.+?)\s+\{#(tbl-[a-z0-9-]+)\}$/;
const UNDERLINE = /\[([^\]\r\n]+)\]\{\.underline\}/g;

/** Render only the two Pandoc display forms present in the accepted paper. */
export function paperDisplayMarkupPlugin() {
  return (tree: Root) => {
    const visit = (node: DisplayNode): void => {
      if (!node.children) return;
      for (let index = 0; index < node.children.length - 1; index++) {
        const current = node.children[index];
        const following = node.children[index + 1];
        if (current.type !== 'paragraph' || following.type !== 'table' || current.children?.length !== 1 || current.children[0].type !== 'text') continue;
        const match = TABLE_CAPTION.exec(current.children[0].value?.trim() ?? '');
        if (!match) continue;
        following.data = { ...following.data, hProperties: { ...following.data?.hProperties,
          id: match[2], 'data-paper-caption': match[1],
          'data-paper-columns': String(following.children?.[0]?.children?.length ?? 1) } };
        node.children.splice(index, 1);
        index--;
      }
      const children: DisplayNode[] = [];
      for (const child of node.children) {
        if (child.type !== 'text' || !child.value) {
          visit(child);
          children.push(child);
          continue;
        }
        let cursor = 0;
        for (const match of child.value.matchAll(UNDERLINE)) {
          const start = match.index ?? 0;
          if (start > cursor) children.push({ type: 'text', value: child.value.slice(cursor, start) });
          children.push({
            type: 'emphasis',
            data: { hName: 'u' },
            children: [{ type: 'text', value: match[1] }],
          });
          cursor = start + match[0].length;
        }
        if (cursor < child.value.length) children.push({ type: 'text', value: child.value.slice(cursor) });
      }
      node.children = children;
    };
    visit(tree as unknown as DisplayNode);
  };
}
