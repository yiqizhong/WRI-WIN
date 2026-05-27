export type FrameBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MetadataXmlNode = {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  path: string[];
  boundingBox?: FrameBoundingBox;
  children: MetadataXmlNode[];
};

export type MetadataTextRef = {
  id: string;
  name: string;
  visible: boolean;
  path: string[];
};

type XmlElement = {
  tag: string;
  attrs: Record<string, string>;
  children: XmlElement[];
};

export function parseMetadataXml(xml: string): MetadataXmlNode[] {
  const roots = parseXmlDocument(xml);
  return roots.map((element) => elementToNode(element, [])).filter((node): node is MetadataXmlNode => node !== null);
}

export function collectTextRefs(nodes: MetadataXmlNode[]): MetadataTextRef[] {
  const refs: MetadataTextRef[] = [];

  function walk(node: MetadataXmlNode): void {
    if (node.type.toUpperCase() === "TEXT") {
      refs.push({
        id: node.id,
        name: node.name,
        visible: node.visible,
        path: node.path
      });
    }

    for (const child of node.children) {
      walk(child);
    }
  }

  for (const root of nodes) {
    walk(root);
  }

  return refs;
}

export function findMetadataNodeById(
  nodes: MetadataXmlNode[],
  nodeId: string
): MetadataXmlNode | undefined {
  function walk(node: MetadataXmlNode): MetadataXmlNode | undefined {
    if (node.id === nodeId) {
      return node;
    }

    for (const child of node.children) {
      const match = walk(child);

      if (match) {
        return match;
      }
    }

    return undefined;
  }

  for (const root of nodes) {
    const match = walk(root);

    if (match) {
      return match;
    }
  }

  return undefined;
}

export function flattenMetadataHierarchy(nodes: MetadataXmlNode[]): Array<{
  id: string;
  name: string;
  type: string;
  parentId?: string;
}> {
  const flat: Array<{ id: string; name: string; type: string; parentId?: string }> = [];

  function walk(node: MetadataXmlNode, parentId?: string): void {
    flat.push({ id: node.id, name: node.name, type: node.type, parentId });

    for (const child of node.children) {
      walk(child, node.id);
    }
  }

  for (const root of nodes) {
    walk(root);
  }

  return flat;
}

function elementToNode(element: XmlElement, ancestorPath: string[]): MetadataXmlNode | null {
  const id = element.attrs.id;
  const name = element.attrs.name ?? element.tag;
  const type = element.attrs.type ?? element.tag;

  if (!id) {
    for (const child of element.children) {
      const nested = elementToNode(child, ancestorPath);

      if (nested) {
        return nested;
      }
    }

    return null;
  }

  const path = [...ancestorPath, name];
  const visible = element.attrs.visible !== "false";
  const boundingBox = parseBoundingBoxAttrs(element.attrs);
  const children = element.children
    .map((child) => elementToNode(child, path))
    .filter((child): child is MetadataXmlNode => child !== null);

  return { id, name, type, visible, path, boundingBox, children };
}

function parseBoundingBoxAttrs(attrs: Record<string, string>): FrameBoundingBox | undefined {
  const x = parseNumericAttr(attrs.x ?? attrs.left);
  const y = parseNumericAttr(attrs.y ?? attrs.top);
  const width = parseNumericAttr(attrs.width ?? attrs.w);
  const height = parseNumericAttr(attrs.height ?? attrs.h);

  if (x === undefined || y === undefined || width === undefined || height === undefined) {
    return undefined;
  }

  return { x, y, width, height };
}

function parseNumericAttr(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseXmlDocument(xml: string): XmlElement[] {
  const trimmed = xml.trim();

  if (!trimmed) {
    return [];
  }

  const roots: XmlElement[] = [];
  let index = 0;

  while (index < trimmed.length) {
    const next = findNextTagStart(trimmed, index);

    if (next === -1) {
      break;
    }

    const parsed = parseElement(trimmed, next);

    if (parsed) {
      roots.push(parsed.element);
      index = parsed.index;
    } else {
      index = next + 1;
    }
  }

  return roots;
}

function parseElement(source: string, start: number): { element: XmlElement; index: number } | null {
  if (source[start] !== "<") {
    return null;
  }

  const close = source.indexOf(">", start);

  if (close === -1) {
    return null;
  }

  const header = source.slice(start + 1, close).trim();

  if (!header || header.startsWith("?") || header.startsWith("!")) {
    return { element: { tag: "?", attrs: {}, children: [] }, index: close + 1 };
  }

  const selfClosing = header.endsWith("/");
  const headerBody = selfClosing ? header.slice(0, -1).trim() : header;
  const parts = headerBody.split(/\s+/);
  const tag = parts[0] ?? "unknown";
  const attrs = parseAttributes(headerBody.slice(tag.length));
  const children: XmlElement[] = [];
  let index = close + 1;

  if (!selfClosing) {
    const endTag = `</${tag}>`;
    const endIndex = source.indexOf(endTag, index);

    if (endIndex === -1) {
      return { element: { tag, attrs, children }, index };
    }

    const inner = source.slice(index, endIndex);
    let childStart = 0;

    while (childStart < inner.length) {
      const childTag = findNextTagStart(inner, childStart);

      if (childTag === -1) {
        break;
      }

      const childParsed = parseElement(inner, childTag);

      if (!childParsed) {
        childStart = childTag + 1;
        continue;
      }

      if (childParsed.element.tag !== "?") {
        children.push(childParsed.element);
      }

      childStart = childParsed.index;
    }

    index = endIndex + endTag.length;
  }

  return { element: { tag, attrs, children }, index };
}

function parseAttributes(fragment: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pattern = /([\w:-]+)\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(fragment)) !== null) {
    attrs[match[1]] = match[2];
  }

  return attrs;
}

function findNextTagStart(source: string, from: number): number {
  return source.indexOf("<", from);
}
