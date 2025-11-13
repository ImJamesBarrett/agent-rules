# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
