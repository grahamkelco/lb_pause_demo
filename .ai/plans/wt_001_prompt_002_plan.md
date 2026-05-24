 Plan: Project Foundation Setup                                                                                 
                                                                                                                
 Context                                                                                                        
                                                                                                                
 This is a greenfield TypeScript monorepo for a load balancer backpressure simulation. The directory skeleton   
 exists (lb/, lb/sidecar/, services/, generator/, web/, docs/) but contains no code or configuration. We need
 to establish the foundational project layout: CLAUDE.md, README.md, TypeScript/ESLint configs, shell scripts,
 and npm workspace setup.

 Decisions

 - Package manager: npm with workspaces
 - ESLint: Flat config (eslint.config.mjs) with @typescript-eslint v8+
 - TypeScript: Root tsconfig.base.json + per-package tsconfig.json extending it

 ---
 Files to Create (18 total, in dependency order)

 1. .gitignore

 node_modules/
 dist/
 *.tsbuildinfo
 .env

 2. package.json (root)

 - "private": true, "type": "module"
 - "workspaces": ["lb", "lb/sidecar", "generator", "web", "services/*"]
 - Shared devDependencies: typescript ~5.7, @typescript-eslint/eslint-plugin ^8, @typescript-eslint/parser ^8,
 eslint ^9, vitest ^3, eslint-plugin-check-file (for snake_case filename enforcement)
 - Root scripts: build, lint, test (each running npm run <cmd> --workspaces --if-present)

 3. tsconfig.base.json

 Strict TypeScript config shared by all packages:
 - target: ES2022, module: Node16, moduleResolution: Node16
 - strict: true plus: noUncheckedIndexedAccess, noImplicitOverride, noFallthroughCasesInSwitch,
 forceConsistentCasingInFileNames, isolatedModules
 - declaration, sourceMap, skipLibCheck, esModuleInterop, resolveJsonModule

 4. Per-package package.json files (4 files)

 Each with "private": true, "type": "module", scripts for build (tsc), lint (eslint src/), test (vitest run):
 - lb/package.json — @backpressure/lb
 - lb/sidecar/package.json — @backpressure/sidecar
 - generator/package.json — @backpressure/generator
 - web/package.json — @backpressure/web

 5. Per-package tsconfig.json files (4 files)

 Each extends ../tsconfig.base.json (or ../../tsconfig.base.json for sidecar), sets outDir: ./dist, rootDir:
 ./src, include: ["src/**/*.ts"].
 - lb/tsconfig.json — also excludes sidecar/ from include
 - lb/sidecar/tsconfig.json
 - generator/tsconfig.json
 - web/tsconfig.json

 6. eslint.config.mjs (root, shared)

 Key rules enforcing the project coding standards:
 - Naming: @typescript-eslint/naming-convention — PascalCase for types/classes, camelCase for
 variables/methods/parameters, UPPER_CASE allowed for constants
 - Method size: max-lines-per-function: 70 (skip blanks/comments)
 - Nesting depth: max-depth: 3
 - Type safety: no-explicit-any: error, no-unused-vars: error (ignore _ prefix), no-floating-promises: error
 - Filenames: eslint-plugin-check-file to enforce snake_case filenames
 - Ignores: **/dist/**, **/node_modules/**

 7. setup.sh

 Functionized bash script with set -euo pipefail:
 - check_command() — verify a command exists on the system
 - check_node() — ensure Node.js is installed
 - install_deps() — run npm install
 - main() — orchestrates checks and install
 - Each function gets a javadoc-style comment with @param / @returns as applicable

 8. run.sh

 Functionized bash script with set -euo pipefail and subcommand dispatch:
 - usage() — prints help text for all subcommands
 - ensure_docker() — checks if Docker is running, starts it on macOS if not
 - resolve_package() — maps target name to npm workspace package name
 - cmd_up() — docker compose up -d (calls ensure_docker)
 - cmd_down() — docker compose down
 - cmd_build() — npm run build -w <package>
 - cmd_lint() — npm run lint -w <package>
 - cmd_test() — npm run test -w <package>
 - main() — case-based dispatch on $1
 - Each function gets a javadoc-style comment

 9. CLAUDE.md

 Project guide for Claude Code:
 - Directory map — listing all directories and their purpose
 - Coding standards — naming conventions, comment style, method constraints, snake_case filenames, no logic in
 index.ts
 - Commands — ./setup.sh, ./run.sh <subcommand>, npm run build/lint/test --workspaces
 - Architecture — monorepo structure with npm workspaces, shared tsconfig/eslint

 10. README.md (replace placeholder)

 - Project title and description (load balancer backpressure simulation)
 - Problem statement (brief, from PROJECT.md)
 - Architecture overview (components list)
 - Quick start (./setup.sh then ./run.sh up)
 - Commands table (run.sh subcommands)
 - Project structure (directory tree)
 - Development section (build/lint/test individual packages)

 ---
 Verification

 1. Run ./setup.sh — should install all dependencies successfully
 2. Run ./run.sh help — should print usage information
 3. Run npm run lint --workspaces --if-present — should succeed (no source files to lint yet, but config should
  be valid)
 4. Run npx tsc --noEmit -p lb/tsconfig.json — should succeed (no files, but config should parse)
 5. Verify ./run.sh build lb maps correctly and runs without error