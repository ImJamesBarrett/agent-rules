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

describe('CLI validation: includes/excludes', () => {
  beforeAll(async () => {
    await tsupBuild({
      entry: ['src/cli.ts'],
      format: ['esm'],
      target: 'node20',
      outDir: 'dist',
      clean: true
    });
  });

  test('accepts single-string includes (coerces to array) and writes output', async () => {
    const outRoot = await makeTemporaryDirectory();
    const cfg = [{ title: 'T', outDir: 'out', files: ['x.md'], includes: 'react' }];
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
        includes: ['react', badValue as unknown as string]
      }
    ];
    const response = await runCli(cfg);
    expect(response.code).toBe(1);
  });

  test('accepts excludes as single string (coerces) and succeeds', async () => {
    const outRoot = await makeTemporaryDirectory();
    const cfg = [
      { title: 'T', outDir: 'out', files: ['x.md'], includes: 'react', excludes: 'react/legacy' }
    ];
    const response = await runCli(cfg, outRoot);
    expect(response.code).toBe(0);
    const exists = await fs.readFile(path.join(outRoot, 'out/x.md'), 'utf8');
    expect(exists.length).toBeGreaterThan(0);
  });

  test('rejects excludes array with non-strings', async () => {
    const cfg = [
      { title: 'T', outDir: 'out', files: ['x.md'], includes: 'react', excludes: ['a', 123] }
    ];
    const response = await runCli(cfg);
    expect(response.code).toBe(1);
  });
});
