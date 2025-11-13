#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import stripJsonComments from 'strip-json-comments';

import { expandHome, generateForBlock, type GenerationBlock } from './core.js';

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length > 0);
}

function getArgumentValue(argv: string[], key: string): string | undefined {
  const index = argv.findIndex((argument) => argument === key || argument.startsWith(key + '='));
  if (index === -1) return undefined;
  const token = argv[index];
  if (token.includes('=')) return token.split('=')[1];
  return argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[index + 1] : undefined;
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const isGenerate = cmd === 'generate' || cmd === 'rules:generate';
  if (!isGenerate) {
    console.error('Usage: agent-rules generate [--config <path>] [--output-root <path>]');
    if (cmd) {
      process.exitCode = 1;
    } else {
      process.exitCode = 0;
    }
    return;
  }

  const configOpt = getArgumentValue(argv, '--config');
  const outputRootOpt = getArgumentValue(argv, '--output-root');

  const projectRoot = process.cwd();
  const configPath = configOpt ? configOpt : path.join(projectRoot, 'agents.config.json');
  const outputRoot = outputRootOpt ? expandHome(outputRootOpt) : projectRoot;

  let configRaw: string;
  try {
    configRaw = await fs.readFile(configPath, 'utf8');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[error] Cannot read config file at ${configPath}: ${message}`);
    process.exitCode = 1;
    return;
  }

  let blocks: unknown;
  try {
    const jsonNoComments = stripJsonComments(configRaw);
    blocks = JSON.parse(jsonNoComments);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[error] Invalid JSON in ${configPath}: ${message}`);
    process.exitCode = 1;
    return;
  }

  if (!Array.isArray(blocks)) {
    console.error('[error] Config must be a top-level array of generation blocks');
    process.exitCode = 1;
    return;
  }

  const array = blocks as unknown[];
  let index = 0;
  for (const bUnknown of array) {
    const ctx = `block[${index}]`;
    if (!bUnknown || typeof bUnknown !== 'object') {
      console.error(`[error] ${ctx} must be an object`);
      process.exitCode = 1;
      return;
    }
    const blockReference = bUnknown as GenerationBlock;
    const { files, outDir, title } = blockReference;
    if (!title || typeof title !== 'string') {
      console.error(`[error] ${ctx}.title is required and must be a string`);
      process.exitCode = 1;
      return;
    }
    if (!outDir || typeof outDir !== 'string') {
      console.error(`[error] ${ctx}.outDir is required and must be a string`);
      process.exitCode = 1;
      return;
    }
    if (!Array.isArray(files) || files.some((f) => typeof f !== 'string' || f.length === 0)) {
      console.error(`[error] ${ctx}.files is required and must be an array of file names`);
      process.exitCode = 1;
      return;
    }
    const rawIncludes: unknown = (bUnknown as Record<string, unknown>)['includes'];
    if (rawIncludes === undefined) {
      console.error(
        `[error] ${ctx}.includes is required and must be a string or an array of non-empty strings`
      );
      process.exitCode = 1;
      return;
    }
    {
      let includesValidated: string[] | undefined;
      if (typeof rawIncludes === 'string') {
        includesValidated = [rawIncludes];
      } else if (isNonEmptyStringArray(rawIncludes)) {
        includesValidated = rawIncludes;
      } else {
        console.error(`[error] ${ctx}.includes must be a string or an array of non-empty strings`);
        process.exitCode = 1;
        return;
      }
      blockReference.includes = includesValidated;
    }

    const rawExcludes: unknown = (bUnknown as Record<string, unknown>)['excludes'];
    if (rawExcludes !== undefined) {
      let excludesValidated: string[] | undefined;
      if (typeof rawExcludes === 'string') {
        excludesValidated = [rawExcludes];
      } else if (isNonEmptyStringArray(rawExcludes)) {
        excludesValidated = rawExcludes;
      } else {
        console.error(`[error] ${ctx}.excludes must be a string or an array of non-empty strings`);
        process.exitCode = 1;
        return;
      }

      blockReference.excludes = excludesValidated;
    }
    index++;
  }

  for (const b of blocks as GenerationBlock[]) await generateForBlock(b, outputRoot);
}

const executedDirectly = (() => {
  try {
    return import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return true;
  }
})();

if (executedDirectly) {
  try {
    await main();
  } catch (error) {
    console.error('[fatal] Unhandled error:', error);
    process.exitCode = 1;
  }
}
