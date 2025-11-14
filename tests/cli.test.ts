import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { build as tsupBuild } from 'tsup';
import { beforeAll, describe, expect, test } from 'vitest';

async function makeTemporaryDirectory(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'agent-rules-cli-'));
}

async function runCli(
  config: unknown,
  outputRoot?: string
): Promise<{
  code: null | number;
  stdout: string;
  stderr: string;
  configPath: string;
  outRoot?: string;
}> {
  const dir = await makeTemporaryDirectory();
  const configPath = path.join(dir, 'config.json');
  await fs.writeFile(configPath, JSON.stringify(config));

  const arguments_ = ['dist/cli.js', 'generate', '--config', configPath];
  if (outputRoot) arguments_.push('--output-root', outputRoot);

  const result = spawnSync('node', arguments_, { cwd: path.resolve('.'), encoding: 'utf8' });
  return {
    code: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    configPath,
    outRoot: outputRoot
  };
}

beforeAll(async () => {
  await tsupBuild({
    entry: ['src/cli.ts'],
    format: ['esm'],
    target: 'node20',
    outDir: 'dist',
    clean: true
  });
});

describe('CLI validation: includes/excludes', () => {
  test('accepts single-string includes and writes output', async () => {
    const sourceDirectory = await makeTemporaryDirectory();
    await fs.mkdir(path.join(sourceDirectory, 'react'), { recursive: true });
    await fs.writeFile(path.join(sourceDirectory, 'react/rule.md'), 'Body');
    const outRoot = await makeTemporaryDirectory();
    const cfg = [
      {
        title: 'T',
        outDir: 'out',
        files: ['x.md'],
        rulesDir: [{ path: sourceDirectory, includes: 'react' }]
      }
    ];
    const response = await runCli(cfg, outRoot);
    expect(response.code).toBe(0);
    const written = await fs.readFile(path.join(outRoot, 'out/x.md'), 'utf8');
    expect(written).toContain('# T');
  });

  test('rejects includes array with non-strings', async () => {
    const badValue = 0;
    const cfg = [
      {
        title: 'T',
        outDir: 'out',
        files: ['x.md'],
        rulesDir: [{ path: './missing', includes: ['react', badValue as unknown as string] }]
      }
    ];
    const response = await runCli(cfg);
    expect(response.code).toBe(1);
  });

  test('accepts excludes as single string and succeeds', async () => {
    const sourceDirectory = await makeTemporaryDirectory();
    await fs.mkdir(path.join(sourceDirectory, 'react/legacy'), { recursive: true });
    await fs.writeFile(path.join(sourceDirectory, 'react/a.md'), 'Body');
    await fs.writeFile(path.join(sourceDirectory, 'react/legacy/b.md'), 'Legacy');

    const outRoot = await makeTemporaryDirectory();
    const cfg = [
      {
        title: 'T',
        outDir: 'out',
        files: ['x.md'],
        rulesDir: [{ path: sourceDirectory, includes: 'react', excludes: 'react/legacy' }]
      }
    ];
    const response = await runCli(cfg, outRoot);
    expect(response.code).toBe(0);
    const exists = await fs.readFile(path.join(outRoot, 'out/x.md'), 'utf8');
    expect(exists).toContain('# T');
    expect(exists).not.toContain('Legacy');
  });

  test('rejects excludes array with non-strings', async () => {
    const cfg = [
      {
        title: 'T',
        outDir: 'out',
        files: ['x.md'],
        rulesDir: [
          { path: './missing', includes: 'react', excludes: ['a', 123 as unknown as string] }
        ]
      }
    ];
    const response = await runCli(cfg);
    expect(response.code).toBe(1);
  });
});

describe('CLI rulesDir handling', () => {
  test('rulesDir entries merge directories with later entries overriding earlier ones', async () => {
    const dirOne = await makeTemporaryDirectory();
    const dirTwo = await makeTemporaryDirectory();
    await fs.mkdir(path.join(dirOne, 'shared'), { recursive: true });
    await fs.mkdir(path.join(dirTwo, 'shared'), { recursive: true });
    await fs.writeFile(path.join(dirOne, 'shared/_index.md'), 'Intro one');
    await fs.writeFile(path.join(dirOne, 'shared/a.md'), 'First A');
    await fs.writeFile(path.join(dirTwo, 'shared/_index.md'), 'Intro two');
    await fs.writeFile(path.join(dirTwo, 'shared/a.md'), 'Second A');
    await fs.writeFile(path.join(dirTwo, 'shared/b.md'), 'Second B');

    const outRoot = await makeTemporaryDirectory();
    const cfg = [
      {
        title: 'Merged',
        outDir: 'out',
        files: ['merged.md'],
        rulesDir: [
          { path: dirOne, includes: ['shared'] },
          { path: dirTwo, includes: '*' }
        ]
      }
    ];

    const response = await runCli(cfg, outRoot);
    expect(response.code).toBe(0);
    const content = await fs.readFile(path.join(outRoot, 'out/merged.md'), 'utf8');
    expect(content).toContain('Intro two');
    expect(content).not.toContain('Intro one');
    expect(content).toContain('Second A');
    expect(content).not.toContain('First A');
    expect(content).toContain('Second B');
  });

  test('rejects empty rulesDir array', async () => {
    const cfg = [{ title: 'T', outDir: 'out', files: ['x.md'], rulesDir: [] }];
    const response = await runCli(cfg);
    expect(response.code).toBe(1);
  });

  test('rejects rulesDir entry missing path', async () => {
    const cfg = [
      {
        title: 'T',
        outDir: 'out',
        files: ['x.md'],
        rulesDir: [{ includes: 'react' } as never]
      }
    ];
    const response = await runCli(cfg);
    expect(response.code).toBe(1);
  });

  test('rejects rulesDir entry missing includes', async () => {
    const cfg = [
      {
        title: 'T',
        outDir: 'out',
        files: ['x.md'],
        rulesDir: [{ path: './missing' } as never]
      }
    ];
    const response = await runCli(cfg);
    expect(response.code).toBe(1);
  });
});
