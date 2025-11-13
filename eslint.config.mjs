// ESLint flat config
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import markdown from '@eslint/markdown';
import eslintComments from 'eslint-plugin-eslint-comments';
import importX from 'eslint-plugin-import-x';
import jsonc from 'eslint-plugin-jsonc';
import jsoncParser from 'jsonc-eslint-parser';
import n from 'eslint-plugin-n';
import perfectionist from 'eslint-plugin-perfectionist';
import promise from 'eslint-plugin-promise';
import regexp from 'eslint-plugin-regexp';
import unicorn from 'eslint-plugin-unicorn';
import unusedImports from 'eslint-plugin-unused-imports';
import yml from 'eslint-plugin-yml';
import yamlParser from 'yaml-eslint-parser';
import eslintConfigPrettier from 'eslint-config-prettier';

const pickRules = (plugin, keys) => {
  for (const key of keys) {
    const conf = plugin?.configs?.[key];
    if (conf && conf.rules) return conf.rules;
  }
  return {};
};

const rulesComments = pickRules(eslintComments, ['recommended']);
const rulesPromise = pickRules(promise, ['recommended', 'flat/recommended']);
const rulesRegexp = pickRules(regexp, ['recommended', 'flat/recommended']);
const rulesUnicorn = pickRules(unicorn, ['recommended']);
const rulesImportX = pickRules(importX, ['recommended']);
const rulesYml = pickRules(yml, ['recommended', 'flat/recommended']);
const rulesJsonc = pickRules(jsonc, [
  'recommended-with-json',
  'recommended-with-jsonc',
  'flat/recommended-with-json',
  'flat/recommended-with-jsonc'
]);
const rulesPerfectionist = pickRules(perfectionist, ['recommended-natural', 'recommended']);

const mergeRulesFromConfig = (cfg) => {
  const arr = Array.isArray(cfg) ? cfg : [cfg];
  const out = {};
  for (const c of arr) {
    if (c && c.rules) Object.assign(out, c.rules);
  }
  return out;
};
const tsRecommendedRules = mergeRulesFromConfig(tseslint.configs.recommended);
const tsTypeCheckedRules = mergeRulesFromConfig(tseslint.configs.recommendedTypeChecked);
const tsAllRules = { ...tsRecommendedRules, ...tsTypeCheckedRules };

export default [
  {
    ignores: [
      'dist/',
      'examples/out/',
      'coverage/',
      '.husky/',
      'commitlint.config.cjs',
      '**/*.d.ts',
      '**/node_modules/**',
      '.pnpm-store/**',
      'eslint.config.*',
      'vitest.config.ts',
      'README.md'
    ]
  },

  js.configs.recommended,
  {
    rules: {
      'comma-dangle': ['error', 'never']
    }
  },

  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    plugins: { '@typescript-eslint': tseslint.plugin, 'unused-imports': unusedImports },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        sourceType: 'module'
      }
    },
    rules: {
      ...tsAllRules,
      '@typescript-eslint/comma-dangle': ['error', 'never'],
      // Prefer the dedicated unused-imports plugin
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' }
      ]
    }
  },

  n.configs['flat/recommended'] || n.configs.recommended,
  {
    rules: {
      // TypeScript + import-x handle module resolution
      'n/no-missing-import': 'off',
      'n/no-extraneous-import': 'off',
      'n/no-unsupported-features/es-syntax': 'off'
    }
  },

  { plugins: { promise }, rules: rulesPromise },

  { plugins: { regexp }, rules: rulesRegexp },

  {
    plugins: { unicorn },
    rules: {
      ...rulesUnicorn,
      // Enforce ESM project style
      'unicorn/prefer-module': 'error',
      'unicorn/prevent-abbreviations': [
        'error',
        {
          allowList: {
            argv: true,
            ctx: true,
            dir: true,
            rel: true,
            outDir: true
          },
          checkFilenames: false
        }
      ],
      'unicorn/no-array-sort': 'off',
      'unicorn/prefer-top-level-await': 'error',
      'unicorn/prefer-single-call': 'error',
      'unicorn/prefer-at': 'error',
      'unicorn/prefer-ternary': 'off',
      'unicorn/prefer-logical-operator-over-ternary': 'off',
      'unicorn/no-immediate-mutation': 'off'
    }
  },

  {
    plugins: { 'import-x': importX },
    settings: {
      'import-x/resolver': { typescript: true, node: true }
    },
    rules: {
      ...rulesImportX,
      'import-x/order': 'off'
    }
  },

  {
    plugins: { perfectionist },
    rules: {
      ...rulesPerfectionist,
      'perfectionist/sort-modules': 'off',
      'perfectionist/sort-objects': 'off',
      'perfectionist/sort-object-types': 'off'
    }
  },

  { plugins: { 'eslint-comments': eslintComments }, rules: rulesComments },

  {
    files: ['**/*.json', '**/*.jsonc'],
    plugins: { jsonc },
    languageOptions: { parser: jsoncParser },
    rules: {
      ...rulesJsonc,
      'jsonc/no-comments': 'off',
      'jsonc/comma-dangle': ['error', 'never']
    }
  },

  {
    files: ['**/*.yml', '**/*.yaml'],
    plugins: { yml },
    languageOptions: { parser: yamlParser },
    rules: { ...rulesYml }
  },

  {
    files: ['**/*.md'],
    processor: markdown.processors.markdown,
    rules: {
      'unicorn/filename-case': 'off'
    }
  },

  {
    files: ['src/cli.ts'],
    rules: {
      // TS source contains a shebang to preserve in built output
      'n/hashbang': 'off'
    }
  },

  eslintConfigPrettier
];
