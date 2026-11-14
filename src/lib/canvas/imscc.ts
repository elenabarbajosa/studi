import { XMLParser } from "fast-xml-parser";

export type ImsManifestResource = {
  identifier: string;
  type: string;
  href: string | null;
  files: string[];
};

export type ImsManifestItem = {
  identifier: string;
  identifierref: string | null;
  title: string;
  children: ImsManifestItem[];
};

export type ImsManifest = {
  title: string | null;
  resources: ImsManifestResource[];
  items: ImsManifestItem[];
  /** Flat module path for each resource id (best-effort). */
  moduleByResourceId: Record<string, string>;
};

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (typeof node === "object" && node && "#text" in node) {
    return String((node as { "#text": unknown })["#text"] ?? "");
  }
  return "";
}

function parseItem(raw: Record<string, unknown>): ImsManifestItem {
  const children = asArray(raw.item as Record<string, unknown> | Record<string, unknown>[]).map(
    (c) => parseItem(c),
  );
  return {
    identifier: String(raw["@_identifier"] ?? ""),
    identifierref: raw["@_identifierref"] ? String(raw["@_identifierref"]) : null,
    title: textOf(raw.title) || "Untitled",
    children,
  };
}

function walkModules(
  items: ImsManifestItem[],
  path: string[],
  out: Record<string, string>,
) {
  for (const item of items) {
    const next = [...path, item.title];
    if (item.identifierref) {
      out[item.identifierref] = next.join(" / ");
    }
    if (item.children.length) walkModules(item.children, next, out);
  }
}

/**
 * Parse Common Cartridge `imsmanifest.xml`.
 * Entities / DTD expansion are disabled (XXE-safe).
 */
export function parseImsManifestXml(xml: string): ImsManifest {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    // Security: never resolve external entities or DTDs
    processEntities: false,
    ignoreDeclaration: true,
    trimValues: true,
    isArray: (name) => name === "item" || name === "file" || name === "resource",
  });

  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch {
    throw new Error("imsmanifest.xml could not be parsed.");
  }

  const manifest = (doc.manifest ?? doc) as Record<string, unknown>;
  const metadata = manifest.metadata as Record<string, unknown> | undefined;
  const lom = metadata?.lom as Record<string, unknown> | undefined;
  const general = lom?.general as Record<string, unknown> | undefined;
  const title =
    textOf(general?.title) ||
    textOf((manifest.organizations as Record<string, unknown> | undefined)?.title) ||
    null;

  const organizations = manifest.organizations as Record<string, unknown> | undefined;
  const orgList = asArray(
    organizations?.organization as Record<string, unknown> | Record<string, unknown>[],
  );
  const items: ImsManifestItem[] = [];
  for (const org of orgList) {
    for (const item of asArray(org.item as Record<string, unknown> | Record<string, unknown>[])) {
      items.push(parseItem(item));
    }
  }

  const resourcesNode = manifest.resources as Record<string, unknown> | undefined;
  const resources: ImsManifestResource[] = [];
  for (const res of asArray(
    resourcesNode?.resource as Record<string, unknown> | Record<string, unknown>[],
  )) {
    const files = asArray(res.file as Record<string, unknown> | Record<string, unknown>[])
      .map((f) => String(f["@_href"] ?? ""))
      .filter(Boolean);
    const href = res["@_href"] ? String(res["@_href"]) : files[0] ?? null;
    resources.push({
      identifier: String(res["@_identifier"] ?? ""),
      type: String(res["@_type"] ?? ""),
      href,
      files: files.length ? files : href ? [href] : [],
    });
  }

  const moduleByResourceId: Record<string, string> = {};
  walkModules(items, [], moduleByResourceId);

  return { title, resources, items, moduleByResourceId };
}
