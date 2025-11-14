import matter from 'gray-matter';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

function titleFromSegments(segments: string[]): string {
  return segments
    .filter(Boolean)
    .map((s) => titleCase(s))
    .join(' / ');
}

export type RulesSource = {
  path: string;
  includes: string | string[];
  excludes?: string | string[];
};

export type GenerationBlock = {
  files: string[];
  maxHeadingDepth?: number;
  outDir: string;
  rulesDir: RulesSource[];
  title: string;
};

export type Rule = {
  content: string;
  fileName: string;
  order: number;
  title: string;
};

export type SectionNode = {
  children: Map<string, SectionNode>;
  depth: number;
  indexContent?: string;
  sectionOrder?: number;
  name: string;
  path: string;
  rules: Rule[];
};

export type FrontMatter = {
  enabled?: boolean;
  order?: number;
};

export function toPosix(filePath: string): string {
  let out = filePath.replaceAll('\\\\', '/');
  while (out.includes('//')) out = out.replaceAll('//', '/');
  return out;
}

export function titleCase(input: string): string {
  const cleaned = input.replaceAll(/[-_]+/g, ' ').trim();
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function expandHome(p: string): string {
  if (!p) return p;
  if (p === '~' || p.startsWith('~/')) {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function walkAllMarkdownFiles(
  rootAbs: string
): Promise<{ abs: string; rel: string }[]> {
  const results: { abs: string; rel: string }[] = [];
  async function walk(currentAbs: string) {
    const entries = await fs.readdir(currentAbs, { withFileTypes: true });
    for (const entry of entries) {
      const childAbs = path.join(currentAbs, entry.name);
      if (entry.isDirectory()) {
        await walk(childAbs);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        const relative = toPosix(path.relative(rootAbs, childAbs));
        results.push({ abs: childAbs, rel: relative });
      }
    }
  }
  await walk(rootAbs);
  return results;
}

export function normalizePrefixes(prefixes: string[] | undefined): string[] {
  if (!prefixes) return [];
  return prefixes
    .map((prefix) =>
      toPosix(prefix.trim())
        .replace(/^\.\/+/, '')
        .replace(/^\/+/, '')
    )
    .filter((prefix) => prefix.length > 0);
}

function ensureArray(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value];
}

type NormalizedRulesSource = {
  pathAbs: string;
  includesAll: boolean;
  includes: string[];
  excludes: string[];
};

function normalizeRulesSource(source: RulesSource): NormalizedRulesSource {
  const expanded = expandHome(source.path);
  const pathAbs = path.isAbsolute(expanded) ? expanded : path.resolve(expanded);

  const includesRaw = ensureArray(source.includes).map((value) => value.trim());
  const includesAll = includesRaw.length === 1 && includesRaw[0] === '*';
  const includes = includesAll ? [] : normalizePrefixes(includesRaw);

  const excludesRaw = source.excludes
    ? ensureArray(source.excludes).map((value) => value.trim())
    : [];
  const excludes = normalizePrefixes(excludesRaw);

  return { pathAbs, includesAll, includes, excludes };
}

export function relStartsWith(relativePath: string, prefix: string): boolean {
  return (
    relativePath === prefix ||
    relativePath.startsWith(prefix + '/') ||
    relativePath.startsWith(prefix + path.posix.sep)
  );
}

export function ensureNode(tree: Map<string, SectionNode>, folderRelative: string): SectionNode {
  const posixRelative = folderRelative === '' ? '' : toPosix(folderRelative);
  if (tree.has(posixRelative)) return tree.get(posixRelative)!;
  const depth = posixRelative === '' ? 0 : posixRelative.split('/').length;
  const lastSegment = posixRelative.split('/').at(-1) ?? '';
  const name = posixRelative === '' ? '' : titleCase(lastSegment);
  const node: SectionNode = {
    name,
    path: posixRelative,
    depth,
    indexContent: undefined,
    sectionOrder: undefined,
    rules: [],
    children: new Map()
  };
  tree.set(posixRelative, node);
  if (posixRelative !== '') {
    const parentRelative = posixRelative.split('/').slice(0, -1).join('/');
    const parent = ensureNode(tree, parentRelative);
    parent.children.set(posixRelative.split('/').at(-1) ?? '', node);
  }
  return node;
}

async function appendDirectoryToTree(
  tree: Map<string, SectionNode>,
  source: NormalizedRulesSource
): Promise<void> {
  const files = await walkAllMarkdownFiles(source.pathAbs);

  const included = files.filter(({ rel }) => {
    if (!source.includesAll) {
      if (source.includes.length === 0) return false;
      const okInc = source.includes.some((p) => relStartsWith(rel, p));
      if (!okInc) return false;
    }
    const blocked = source.excludes.some((p) => relStartsWith(rel, p));
    return !blocked;
  });

  for (const file of included) {
    const relPosix = toPosix(file.rel);
    const segments = relPosix.split('/');
    const fileName = segments.pop()!;
    const folderRelative = segments.join('/');
    const node = ensureNode(tree, folderRelative);

    const raw = await fs.readFile(file.abs, 'utf8');
    const parsed = matter(raw) as { data: FrontMatter | undefined; content: string };
    const frontmatter: FrontMatter = parsed.data ?? {};
    const ruleFrontmatterOrder =
      typeof frontmatter.order === 'number' ? frontmatter.order : undefined;
    const order = ruleFrontmatterOrder ?? 0;
    const baseName = fileName.replace(/\.md$/i, '');
    const body = parsed.content.trim();
    const isIndex = fileName.toLowerCase() === '_index.md';
    const disabled = frontmatter.enabled === false;
    if (isIndex) {
      node.sectionOrder = disabled ? undefined : ruleFrontmatterOrder;
      node.indexContent = disabled ? undefined : body;
      continue;
    }

    node.rules = node.rules.filter((rule) => rule.fileName !== baseName);
    if (disabled) continue;

    node.rules.push({
      title: titleCase(baseName),
      order,
      fileName: baseName,
      content: body
    });
  }
}

export async function buildTree(source: RulesSource): Promise<Map<string, SectionNode>> {
  const tree = new Map<string, SectionNode>();
  const normalized = normalizeRulesSource(source);
  await appendDirectoryToTree(tree, normalized);
  return tree;
}

export function sortTreeChildren(node: SectionNode): void {
  node.rules.sort((a, b) => a.order - b.order || a.fileName.localeCompare(b.fileName));
  const entries = [...node.children.entries()].sort((a, b) => {
    const aOrder = a[1].sectionOrder;
    const bOrder = b[1].sectionOrder;
    const aHas = typeof aOrder === 'number';
    const bHas = typeof bOrder === 'number';
    if (aHas && bHas) return aOrder - bOrder || a[0].localeCompare(b[0]);
    if (aHas) return -1;
    if (bHas) return 1;
    return a[0].localeCompare(b[0]);
  });
  node.children = new Map(entries);
  for (const [, child] of node.children) sortTreeChildren(child);
}

export function renderTree(
  tree: Map<string, SectionNode>,
  title: string,
  options?: { maxHeadingDepth?: number }
): string {
  const maxHeadingDepth = Math.min(6, Math.max(2, options?.maxHeadingDepth ?? 4));
  const existingRoot = tree.get('');
  const root: SectionNode = existingRoot ?? {
    name: '',
    path: '',
    depth: 0,
    rules: [],
    children: new Map<string, SectionNode>()
  };
  sortTreeChildren(root);

  const lines: string[] = [];
  const banner = '<!-- Generated by @imjamesbarrett/agent-rules – do not edit directly. -->';
  lines.push(banner, '', `# ${title}`, '');

  if (root.indexContent && root.indexContent.trim().length > 0) {
    lines.push(root.indexContent, '');
  }

  for (const r of root.rules) {
    lines.push(`=== ${r.title} ===`, '');
    if (r.content.length > 0) lines.push(r.content);
    lines.push('');
  }

  const capSegmentIndex = maxHeadingDepth - 1;

  function renderNode(n: SectionNode) {
    const headingLevel = n.depth + 1;
    const pathSegments = n.path ? n.path.split('/') : [];
    const beyondSegments = pathSegments.slice(capSegmentIndex);

    if (n.depth > 0 && headingLevel <= maxHeadingDepth) {
      const hashes = '#'.repeat(headingLevel);
      lines.push(`${hashes} ${n.name}`, '');
      if (n.indexContent && n.indexContent.trim().length > 0) {
        lines.push(n.indexContent, '');
      }
    } else if (
      headingLevel > maxHeadingDepth &&
      n.indexContent &&
      n.indexContent.trim().length > 0
    ) {
      const label = titleFromSegments(beyondSegments);
      if (label) lines.push(`(${label})`);
      lines.push(n.indexContent, '');
    }

    for (const r of n.rules) {
      const label = headingLevel > maxHeadingDepth ? titleFromSegments(beyondSegments) : '';
      const fullTitle = label ? `${label} — ${r.title}` : r.title;
      lines.push(`=== ${fullTitle} ===`, '');
      if (r.content.length > 0) lines.push(r.content);
      lines.push('');
    }
    for (const [, child] of n.children) renderNode(child);
  }

  for (const [, child] of root.children || new Map()) renderNode(child);
  while (lines.length > 0 && lines.at(-1) === '') lines.pop();
  return lines.join('\n') + '\n';
}

export async function generateForBlock(block: GenerationBlock, outputRoot: string): Promise<void> {
  if (!block.rulesDir || block.rulesDir.length === 0) {
    console.warn('[warn] rulesDir is empty; no rules will be included for this block');
  }

  const tree = new Map<string, SectionNode>();
  for (const source of block.rulesDir || []) {
    const normalized = normalizeRulesSource(source);
    const exists = await pathExists(normalized.pathAbs);
    if (!exists) {
      console.warn(`[warn] rulesDir not found: ${normalized.pathAbs}`);
      continue;
    }
    await appendDirectoryToTree(tree, normalized);
  }
  if (!tree.has(''))
    tree.set('', {
      name: '',
      path: '',
      depth: 0,
      indexContent: undefined,
      rules: [],
      children: new Map()
    });
  const markdown = renderTree(tree, block.title, { maxHeadingDepth: block.maxHeadingDepth });

  const outRoot = path.isAbsolute(outputRoot) ? outputRoot : path.resolve(outputRoot);
  const outDirectoryResolved = path.join(outRoot, block.outDir);
  await fs.mkdir(outDirectoryResolved, { recursive: true });
  for (const fileName of block.files) {
    const outPath = path.join(outDirectoryResolved, fileName);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, markdown, 'utf8');
    console.log(`[ok] wrote ${toPosix(path.relative(process.cwd(), outPath))}`);
  }
}
