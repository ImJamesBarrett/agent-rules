# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- markdownlint-disable MD024 -->

## [0.3.0] - 2025-11-14

### Added

- Allow `_index.md` `order` front-matter to control section ordering, so overview folders can
  surface above alphabetical sections while preserving their nested children.

## [0.2.0] - 2025-11-14

### Added

- Support multiple `rulesDir` sources per block with per-source `includes`/`excludes` filters and
  validation.

### Changed

- Clarified README and validation docs to match the new per-source configuration flow.

## [0.1.1] - 2025-11-13

### Fixed

- Corrected usage examples in README.md (removed duplicate command names in npx/pnpm examples)

## [0.1.0] - 2025-11-13

### Added

- Initial release of agent-rules CLI tool
- Generate markdown rule documentation from centralised rules library
- Hierarchical rule organisation with folder-to-heading mapping
- Flexible include/exclude patterns for folders and files
- Configurable heading depth with automatic flattening
- Front-matter support for enabled status and sort order
- Root-level `_index.md` support for section introductions
- Automatic filename to Title Case conversion
- ESM-only package with TypeScript support
- Comprehensive test coverage (96%+ statements)
