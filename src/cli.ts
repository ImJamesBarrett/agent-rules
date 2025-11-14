#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import stripJsonComments from 'strip-json-comments';

import { expandHome, generateForBlock, type GenerationBlock, type RulesSource } from './core.js';

function getArgumentValue(argv: string[], key: string): string | undefined {
  const index = argv.findIndex((argument) => argument === key || argument.startsWith(key + '='));
  if (index === -1) return undefined;
  const token = argv[index];
  if (token.includes('=')) return token.split('=')[1];
  return argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[index + 1] : undefined;
}

function validateStringList(value: unknown, ctx: string): string[] | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      console.error(`[error] ${ctx} must be a non-empty string or an array of non-empty strings`);
      return undefined;
    }
    return [trimmed];
  }
  if (Array.isArray(value) && value.length > 0) {
    const out: string[] = [];
    for (const [index, entry] of value.entries()) {
      if (typeof entry !== 'string') {
        console.error(`[error] ${ctx}[${index}] must be a non-empty string`);
        return undefined;
      }
      const trimmed = entry.trim();
      if (trimmed.length === 0) {
        console.error(`[error] ${ctx}[${index}] must be a non-empty string`);
        return undefined;
      }
      out.push(trimmed);
    }
    return out;
  }
  console.error(`[error] ${ctx} must be a string or an array of non-empty strings`);
  return undefined;
}

function validateIncludesValue(value: unknown, ctx: string): string | string[] | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      console.error(`[error] ${ctx} must be a non-empty string or an array of non-empty strings`);
      return undefined;
    }
    return trimmed;
  }
  if (Array.isArray(value) && value.length > 0) {
    const entries: string[] = [];
    for (const [index, entry] of value.entries()) {
      if (typeof entry !== 'string') {
        console.error(`[error] ${ctx}[${index}] must be a non-empty string`);
        return undefined;
      }
      const trimmed = entry.trim();
      if (trimmed.length === 0) {
        console.error(`[error] ${ctx}[${index}] must be a non-empty string`);
        return undefined;
      }
      entries.push(trimmed);
    }
    if (entries.length === 1 && entries[0] === '*') return '*';
    if (entries.includes('*')) {
      console.error(`[error] ${ctx} may only contain "*" by itself to include all files`);
      return undefined;
    }
    return entries;
  }
  console.error(`[error] ${ctx} must be a string or an array of non-empty strings`);
  return undefined;
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
    const rawRulesDirectory: unknown = (bUnknown as Record<string, unknown>)['rulesDir'];
    if (!Array.isArray(rawRulesDirectory) || rawRulesDirectory.length === 0) {
      console.error(`[error] ${ctx}.rulesDir is required and must be a non-empty array`);
      process.exitCode = 1;
      return;
    }

    const validatedSources: RulesSource[] = [];
    let sourceIndex = 0;
    for (const entry of rawRulesDirectory as unknown[]) {
      const entryContext = `${ctx}.rulesDir[${sourceIndex}]`;
      if (!entry || typeof entry !== 'object') {
        console.error(`[error] ${entryContext} must be an object with path and includes fields`);
        process.exitCode = 1;
        return;
      }
      const record = entry as Record<string, unknown>;
      const pathValue = record['path'];
      const trimmedPath = typeof pathValue === 'string' ? pathValue.trim() : '';
      if (typeof pathValue !== 'string' || trimmedPath.length === 0) {
        console.error(`[error] ${entryContext}.path is required and must be a non-empty string`);
        process.exitCode = 1;
        return;
      }

      const includesValue = record['includes'];
      if (includesValue === undefined) {
        console.error(
          `[error] ${entryContext}.includes is required and must be a string or an array of non-empty strings`
        );
        process.exitCode = 1;
        return;
      }
      const includesValidated = validateIncludesValue(includesValue, `${entryContext}.includes`);
      if (includesValidated === undefined) {
        process.exitCode = 1;
        return;
      }

      let excludesValidated: string[] | undefined;
      if (record['excludes'] !== undefined) {
        excludesValidated = validateStringList(record['excludes'], `${entryContext}.excludes`);
        if (excludesValidated === undefined) {
          process.exitCode = 1;
          return;
        }
      }

      validatedSources.push({
        path: trimmedPath,
        includes: includesValidated,
        excludes: excludesValidated
      });
      sourceIndex++;
    }

    blockReference.rulesDir = validatedSources;
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
