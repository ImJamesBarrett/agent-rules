# @imjamesbarrett/agent-rules

Generate project‑specific Markdown rule docs from a reusable rules library. Point it at a rules
directory, describe what you want in a small JSON config, and it writes one or more Markdown files
for your project.

- Folder structure -> headings; files -> rule blocks
- Include/exclude by folder or by file
- Sensible defaults (H4 heading cap, root files supported)

## Quick start (no install)

- npm (npx)
  - `npx -y @imjamesbarrett/agent-rules generate`
- pnpm
  - `pnpm dlx @imjamesbarrett/agent-rules generate`

## Install

- Dev dependency:

```json
{
  "devDependencies": {
    "@imjamesbarrett/agent-rules": "^0.1.1"
  },
  "scripts": {
    "rules:generate": "agent-rules generate"
  }
}
```

Run: `npm run rules:generate`

## Command

```text
agent-rules generate [--config <path>] [--output-root <path>]
```

- `--config` path to config (default `./agents.config.json`).
- `--output-root` prepends to each block’s `outDir` (default current directory).

## Configuration (agents.config.json)

Top‑level array of objects. Each object writes one or more files with the same content.

```jsonc
[
  {
    "title": "Subfolder rules",
    "outDir": "./resources/",
    "files": ["AGENTS.md"],
    "rulesDir": "~/.agents",
    "includes": [
      "lorem-ipsum", // all lorem ipsum rules
      "lorem-ipsum/food-ipsum/hotdog-ipsum.md" // plus a single rule
    ],
    "excludes": [
      "lorem-ipsum/animal-ipsum", // exclude a folder
      "lorem-ipsum/food-ipsum/coffee-ipsum.md" // exclude exact file
    ]
  },
  {
    "title": "Root rules",
    "outDir": "./",
    "files": ["AGENTS.md", "CLAUDE.md"],
    "rulesDir": "~/.agents",
    "includes": [
      "lorem-ipsum/developer-ipsum", // folder
      "lorem-ipsum/food-ipsum" // folder
    ],
    "excludes": [
      "lorem-ipsum/food-ipsum/cupcake-ipsum.md" // exact file
    ],
    "maxHeadingDepth": 4 // optional; default is 4
  }
]
```

### Block fields

- `title` (string): H1 at the top of each output file.
- `outDir` (string): output directory (relative to project root or `--output-root`).
- `files` (string[]): file names to write; all receive the same content.
- `includes` (string | string[]): path prefixes within `rulesDir` to include (folder or file).
  - You may pass a single string (will be coerced to an array) or an array of non‑empty strings.
- `excludes` (string | string[]): path prefixes to exclude; excludes win over includes.
  - You may pass a single string (will be coerced to an array) or an array of non‑empty strings.
- `rulesDir` (string): rules directory for this block (default `~/.agents`, `~` expanded).
- `maxHeadingDepth` (number): deepest folder heading rendered (H2..H6; default 4).

## Rules directory (rulesDir)

Default `~/.agents`. Structure it how you like. Example:

```txt
~/.agents/
  lorem-ipsum/
    animal-ipsum/
      unicorn-ipsum.md
    developer-ipsum/
      git-ipsum.md
      code-ipsum.md
    food-ipsum/
      bacon-ipsum.md
      coffee-ipsum.md
      hotdog-ipsum.md
```

## Rendering

- Title: `# {title}` at the top.
- Folders -> headings:
  - H2 for depth‑1, H3 for depth‑2, H4 for depth‑3 (default cap H4).
  - Deeper folders are flattened; their path is prefixed into rule titles (e.g. `A / B — Title`).
- `_index.md` (folder intro): shown under its section; if flattened, a simple `(A / B)` label
  appears above the text.
- Rule files -> blocks (filename to Title Case):

```markdown
=== Title ===

<markdown content>
```

- Ordering inside a folder: by front‑matter `order` (asc), then by filename (asc).
- Root‑level: root `_index.md` appears after the title; root rule files come next, then sections.

Optional front‑matter (per rule file):

```yaml
---
enabled: true | false # default true
order: 0 # default 0
---
```

## Include / exclude rules

- Paths are relative to `rulesDir`.
- Folder include: `"lorem-ipsum"` -> everything under that folder.
- File include: `"lorem-ipsum/food-ipsum/hotdog-ipsum.md"` -> only that file.
- Root files: `"_index.md"`, `"overview.md"`.
- Excludes use the same rules and take precedence.
- No globs/wildcards; prefix or exact match.

### Validation and common errors

The CLI validates configuration up‑front to avoid confusing runtime errors:

- `includes` is required per block and must be a string or an array of non‑empty strings.
- `excludes` is optional; if present it must be a string or an array of non‑empty strings.

If validation fails the CLI exits with code 1 and a helpful message, for example:

```text
[error] block[0].includes must be a string or an array of non-empty strings
```

Examples of accepted shapes:

```jsonc
[
  {
    "title": "Subfolder rules",
    "outDir": "./resources",
    "files": ["AGENTS.md"],
    "includes": "lorem-ipsum" // single string is OK
  },
  {
    "title": "Root rules",
    "outDir": "./",
    "files": ["AGENTS.md"],
    "includes": ["lorem-ipsum/developer-ipsum", "lorem-ipsum/food-ipsum"],
    "excludes": "lorem-ipsum/food-ipsum/cupcake-ipsum.md" // single string is OK
  }
]
```

## Examples

Run with a custom config:

```bash
npx -y @imjamesbarrett/agent-rules generate \
  --config ./examples/agents.config.json \
  --output-root .
```

Generated files can be checked into your repo if tools/agents read them there.

## Contributing (maintainers)

- Node 20+, pnpm.
- Scripts: `lint`, `format:check`, `lint:md`, `types`, `test`.
- Conventional Commits; hooks run lint‑staged and types.
