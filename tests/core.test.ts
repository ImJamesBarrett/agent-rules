import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import {
  buildTree,
  ensureNode,
  expandHome,
  generateForBlock,
  type GenerationBlock,
  normalizePrefixes,
  relStartsWith,
  renderTree,
  titleCase,
  toPosix
} from '../src/core.js';

const tmpdirs: string[] = [];

async function makeTemporaryDirectory(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-rules-'));
  tmpdirs.push(dir);
  return dir;
}

async function write(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
}

describe('core helpers', () => {
  test('toPosix and titleCase', () => {
    expect(toPosix(String.raw`a\\b/c`)).toBe('a/b/c');
    expect(titleCase('laravel_blade-components')).toBe('Laravel Blade Components');
  });

  test('normalizePrefixes and relStartsWith', () => {
    const prefixes = normalizePrefixes(['./react', '/git', '']);
    expect(prefixes).toEqual(['react', 'git']);
    expect(relStartsWith('react/hooks/use-effect.md', 'react')).toBe(true);
    expect(relStartsWith('git/safety.md', 'react')).toBe(false);
  });

  test('expandHome resolves ~', () => {
    const p = expandHome('~/test');
    expect(p.startsWith(os.homedir())).toBe(true);
  });
});

describe('tree building and rendering', () => {
  let rulesDirectory: string;
  beforeAll(async () => {
    rulesDirectory = await makeTemporaryDirectory();
    await write(path.join(rulesDirectory, 'laravel/_index.md'), 'Laravel intro');
    await write(
      path.join(rulesDirectory, 'laravel/blade/conditionals.md'),
      '---\norder: 2\n---\nC1'
    );
    await write(path.join(rulesDirectory, 'laravel/blade/components.md'), '---\norder: 3\n---\nC2');
    await write(path.join(rulesDirectory, 'laravel/blade/_index.md'), 'Blade intro');
    await write(path.join(rulesDirectory, 'laravel/validation/basics.md'), 'Basics');
    await write(
      path.join(rulesDirectory, 'laravel/ignored.md'),
      '---\nenabled: false\n---\nignored'
    );
    await write(path.join(rulesDirectory, 'react/_index.md'), 'React intro');
    await write(path.join(rulesDirectory, 'react/hooks/use-effect.md'), 'Effect rule');
    await write(path.join(rulesDirectory, 'git/safety.md'), 'Safety');
  });

  afterAll(async () => {
    for (const d of tmpdirs) {
      try {
        await fs.rm(d, { recursive: true, force: true });
      } catch {
        void 0;
      }
    }
  });

  test('includes/excludes filter correctly and sort folders', async () => {
    const tree = await buildTree(rulesDirectory, ['laravel', 'git'], ['laravel/blade']);
    const root = ensureNode(tree, '');
    expect([...root.children.keys()].sort()).toEqual(['git', 'laravel']);
    const laravel = root.children.get('laravel');
    expect(laravel).toBeTruthy();
    expect(laravel && laravel.children.has('blade')).toBe(false);
  });

  test('_index.md appears before rules and headings reflect depth', async () => {
    const tree = await buildTree(rulesDirectory, ['react'], []);
    const md = renderTree(tree, 'Front end rules');
    const index = md.indexOf('React intro');
    const rule = md.indexOf('=== Use Effect ===');
    expect(index).toBeGreaterThan(-1);
    expect(rule).toBeGreaterThan(index);
    expect(md).toContain('## React');
    expect(md).toContain('### Hooks');
  });

  test('order then filename sorting inside a folder', async () => {
    const tree = await buildTree(rulesDirectory, ['laravel/blade'], []);
    const md = renderTree(tree, 'Blade Rules');
    const posCond = md.indexOf('=== Conditionals ===');
    const posComp = md.indexOf('=== Components ===');
    expect(posCond).toBeLessThan(posComp);
  });

  test('maxHeadingDepth=5 flattens deeper folders and prefixes titles', async () => {
    const deepRoot = await makeTemporaryDirectory();
    await write(path.join(deepRoot, 'react/_index.md'), 'React intro');
    await write(path.join(deepRoot, 'react/hooks/_index.md'), 'Hooks intro');
    await write(path.join(deepRoot, 'react/hooks/data/queries/_index.md'), 'Queries intro');
    await write(path.join(deepRoot, 'react/hooks/data/queries/more/_index.md'), 'More intro');
    await write(path.join(deepRoot, 'react/hooks/data/queries/more/use-user.md'), 'Use user body');
    await write(
      path.join(deepRoot, 'react/hooks/data/queries/more/even/deeper/sample.md'),
      'Sample body'
    );

    const tree = await buildTree(deepRoot, ['react'], []);
    const md = renderTree(tree, 'Front end rules', { maxHeadingDepth: 5 });
    expect(md).toContain('##### Queries');
    expect(md).not.toContain('###### More');
    expect(md).toContain('=== More — Use User ===');
    expect(md).toContain('=== More / Even / Deeper — Sample ===');
    expect(md).toContain('(More)');
    expect(md).toContain('More intro');
  });

  test('default cap (H4) flattens beyond H4', async () => {
    const deepRoot = await makeTemporaryDirectory();
    await write(path.join(deepRoot, 'react/_index.md'), 'React intro');
    await write(path.join(deepRoot, 'react/hooks/data/queries/_index.md'), 'Queries intro');
    await write(path.join(deepRoot, 'react/hooks/data/queries/more/deeper/sample.md'), 'Body');

    const tree = await buildTree(deepRoot, ['react'], []);
    const md = renderTree(tree, 'Front end rules');
    expect(md).toContain('#### Data');
    expect(md).not.toContain('##### ');
    expect(md).not.toContain('###### ');
    expect(md).toContain('(Queries)');
    expect(md).toContain('=== Queries / More / Deeper — Sample ===');
  });

  test('emits root intro and root rules before sections', async () => {
    const dir = await makeTemporaryDirectory();
    await write(path.join(dir, '_index.md'), 'Root intro here');
    await write(path.join(dir, 'overview.md'), 'Overview body');
    await write(path.join(dir, 'react/_index.md'), 'React intro');

    const tree = await buildTree(dir, ['_index.md', 'overview.md', 'react'], []);
    const md = renderTree(tree, 'Project rules');

    const indexH1 = md.indexOf('# Project rules');
    const indexRootIntro = md.indexOf('Root intro here');
    const indexRootRule = md.indexOf('=== Overview ===');
    const indexSection = md.indexOf('## React');

    expect(indexH1).toBeLessThan(indexRootIntro);
    expect(indexRootIntro).toBeLessThan(indexRootRule);
    expect(indexRootRule).toBeLessThan(indexSection);
  });

  test('trims only leading and trailing whitespace of rule content', async () => {
    const dir = await makeTemporaryDirectory();
    const raw = '\n\n   first line\nsecond line\n\n\n  \n';
    await write(path.join(dir, 'x/trim-test.md'), raw);
    const tree = await buildTree(dir, ['x'], []);
    const md = renderTree(tree, 'Trim Rules');

    expect(md).toMatch(/=== Trim Test ===\n\nfirst line\nsecond line\n/);
  });
});

describe('generation outputs', () => {
  test('generateForBlock writes identical content to multiple files', async () => {
    const rulesDirectory = await makeTemporaryDirectory();
    await write(path.join(rulesDirectory, 'x/_index.md'), 'Intro');
    await write(path.join(rulesDirectory, 'x/a.md'), 'A');
    const outRoot = await makeTemporaryDirectory();
    const block: GenerationBlock = {
      title: 'T1',
      outDir: './out',
      files: ['one.md', 'two.md'],
      includes: ['x'],
      rulesDir: rulesDirectory
    };
    await generateForBlock(block, outRoot);
    const a = await fs.readFile(path.join(outRoot, 'out/one.md'), 'utf8');
    const b = await fs.readFile(path.join(outRoot, 'out/two.md'), 'utf8');
    expect(a).toBe(b);
    const banner = '<!-- Generated by @imjamesbarrett/agent-rules – do not edit directly. -->';
    expect(a.startsWith(`${banner}\n\n# T1`)).toBe(true);
  });

  test('empty includes yields only the title section', async () => {
    const rulesDirectory = await makeTemporaryDirectory();
    await write(path.join(rulesDirectory, 'a/b.md'), 'Body');
    const outRoot = await makeTemporaryDirectory();
    const block: GenerationBlock = {
      title: 'Only Title',
      outDir: './',
      files: ['x.md'],
      includes: [],
      rulesDir: rulesDirectory
    };
    await generateForBlock(block, outRoot);
    const content = await fs.readFile(path.join(outRoot, 'x.md'), 'utf8');
    const banner = '<!-- Generated by @imjamesbarrett/agent-rules – do not edit directly. -->';
    expect(content.startsWith(`${banner}\n\n# Only Title`)).toBe(true);
  });
});
