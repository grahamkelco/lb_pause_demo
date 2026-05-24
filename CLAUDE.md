# Backpressure Simulation - Claude Code Guide

## Directory Map
```
.ai/plans/        Project plans (PROJECT.md is the source of truth)
.ai/skills/       AI agent skills
docs/             Project documentation
lb/               Load balancer package (@backpressure/lb)
lb/sidecar/       Sidecar pause-detector package (@backpressure/sidecar)
services/<name>/  Demo server packages
generator/        Load generator package (@backpressure/generator)
web/              Web UI + backend package (@backpressure/web)
```

## Architecture
- npm workspaces monorepo with shared TypeScript and ESLint configs
- Root `tsconfig.base.json` extended by each package's `tsconfig.json`
- Root `eslint.config.mjs` (flat config) shared across all packages
- Each package has its own `package.json` with `build`, `lint`, and `test` scripts

## Coding Standards

### Naming
- **Classes/Types:** PascalCase (e.g., `LoadBalancer`, `DrainCommand`)
- **Methods/Variables:** camelCase (e.g., `routeRequest`, `serverCount`)
- **Constants:** UPPER_CASE (e.g., `MAX_RETRIES`)
- **Filenames:** snake_case (e.g., `load_balancer.ts`, `drain_command.ts`)

### Comments
- All classes must have a class-level javadoc comment
- All methods must have a method-level javadoc comment with `@param` and `@returns`
- Detailed algorithmic notes go inside the method body, not in the method comment
- Shell functions use `##` comment blocks with `@param` and `@returns`

### Code Structure
- No application logic in `index.ts` files (use them only for re-exports)
- Methods: max 70 lines, max 3 levels of nesting
- Bias towards small, readable methods
- Avoid over-complexity and boilerplate — this is a demo, keep it readable

### TypeScript
- Strict mode enabled (see `tsconfig.base.json` for full flag list)
- No `any` types — use proper typing
- No floating promises — always await or handle
- Prefer `const` over `let`

## Commands
```bash
./setup.sh              # Install all dependencies
./run.sh help           # Show available commands
./run.sh up             # Start Docker containers
./run.sh down           # Stop Docker containers
./run.sh build <target> # Build a package (lb, sidecar, generator, web)
./run.sh lint <target>  # Lint a package
./run.sh test <target>  # Test a package
```
