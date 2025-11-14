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
    "@imjamesbarrett/agent-rules": "^0.3.0"
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
    "rulesDir": [
      {
        "path": "~/.agents",
        "includes": [
          "lorem-ipsum", // all lorem ipsum rules
          "lorem-ipsum/food-ipsum/hotdog-ipsum.md" // plus a single rule
        ],
        "excludes": [
          "lorem-ipsum/animal-ipsum", // exclude a folder
          "lorem-ipsum/food-ipsum/coffee-ipsum.md" // exclude exact file
        ]
      }
    ]
  },
  {
    "title": "Root rules",
    "outDir": "./",
    "files": ["AGENTS.md", "CLAUDE.md"],
    "rulesDir": [
      {
        "path": "~/.agents",
        "includes": [
          "lorem-ipsum/developer-ipsum", // folder
          "lorem-ipsum/food-ipsum" // folder
        ],
        "excludes": [
          "lorem-ipsum/food-ipsum/cupcake-ipsum.md" // exact file
        ]
      },
      {
        "path": "./.agents",
        "includes": "*", // include everything from project rules
        "excludes": ["wip"] // optional project-only excludes
      }
    ],
    "maxHeadingDepth": 4 // optional; default is 4
  }
]
```

### Block fields

- `title` (string): H1 at the top of each output file.
- `outDir` (string): output directory (relative to project root or `--output-root`).
- `files` (string[]): file names to write; all receive the same content.
- `rulesDir` (RulesSource[]): ordered list of rule sources to merge.
  - `path` (string): directory containing Markdown rules (relative or absolute; `~` expands).
  - `includes` (string | string[]): prefixes within that directory to include. Use `"*"` to include
    everything under the source before applying excludes.
  - `excludes` (string | string[], optional): prefixes to drop after includes; excludes win over
    includes.
  - Later entries override earlier ones when their relative paths (including `_index.md`) match.
- `maxHeadingDepth` (number): deepest folder heading rendered (H2..H6; default 4).

## Rules sources (rulesDir)

Each block declares `rulesDir` as an array of sources. Every source points at a directory, declares
which prefixes to include (or `"*"` for all of them), and can optionally exclude additional
prefixes. Later sources overlay earlier ones so project-specific rules can override shared guidance.
Structure each source directory however you like. Example:

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

Example `rulesDir` array:

```jsonc
"rulesDir": [
  {
    "path": "~/.agents",
    "includes": ["lorem-ipsum/developer-ipsum"],
    "excludes": ["lorem-ipsum/developer-ipsum/legacy.md"]
  },
  {
    "path": "./.agents",
    "includes": "*" // pull every project rule, then apply optional excludes
  }
]
```

The CLI reads `~/.agents` first, then `./.agents`, so project files replace shared ones when their
relative paths match. Use `enabled: false` in the project copy to remove a shared rule entirely.

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

- Each `rulesDir` entry has its own `includes`/`excludes`. Paths are always relative to that entry’s
  `path`.
- Folder include: `"lorem-ipsum"` -> everything under that folder.
- File include: `"lorem-ipsum/food-ipsum/hotdog-ipsum.md"` -> only that file.
- Use `"*"` (string or single-item array) to include every Markdown file in the source directory
  before applying excludes.
- Root files: `"_index.md"`, `"overview.md"`.
- Excludes use the same prefix rules and take precedence.
- No globs/wildcards beyond `"*"`; prefix or exact match only.

### Validation and common errors

The CLI validates configuration up‑front to avoid confusing runtime errors:

- Every block must provide a non-empty `rulesDir` array.
- Each `rulesDir[i].path` must be a non-empty string.
- Each `rulesDir[i].includes` is required (no block-level fallback) and must be `"*"`, a non-empty
  string, or an array of non-empty strings (arrays may only contain `"*"` if it is the only entry).
- `rulesDir[i].excludes` is optional per entry but, if present, must be a string or a non-empty
  array of strings.

If validation fails the CLI exits with code 1 and a helpful message, for example:

```text
[error] block[0].rulesDir[1].includes is required and must be a string or an array of non-empty strings
```

Examples of accepted shapes:

```jsonc
[
  {
    "title": "Subfolder rules",
    "outDir": "./resources",
    "files": ["AGENTS.md"],
    "rulesDir": [
      { "path": "~/.agents", "includes": "lorem-ipsum" } // single string is OK
    ]
  },
  {
    "title": "Root rules",
    "outDir": "./",
    "files": ["AGENTS.md"],
    "rulesDir": [
      {
        "path": "~/.agents",
        "includes": ["lorem-ipsum/developer-ipsum", "lorem-ipsum/food-ipsum"],
        "excludes": "lorem-ipsum/food-ipsum/cupcake-ipsum.md" // single string is OK
      },
      { "path": "./.agents", "includes": "*" }
    ]
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
