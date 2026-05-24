#!/usr/bin/env bash
# run.sh - Project command runner for building, testing, linting, and managing containers.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

## Prints usage information for all available subcommands.
usage() {
  cat <<EOF
Usage: ./run.sh <command> [options]

Commands:
  up              Bring up Docker containers (starts Docker if needed)
  down            Bring down Docker containers
  build <target>  Build the specified package (lb, sidecar, generator, web)
  lint <target>   Run the linter on the specified package
  test <target>   Run unit tests for the specified package
  help            Show this help message

Targets:
  lb         Load balancer
  sidecar    Load balancer sidecar
  generator  Load generator
  web        Web UI server

Examples:
  ./run.sh up
  ./run.sh build lb
  ./run.sh test generator
  ./run.sh lint web
EOF
}

## Maps a short target name to the corresponding npm workspace package name.
## @param $1 - Short target name (lb, sidecar, generator, web).
## @returns Prints the full package name to stdout. Exits with error if unknown.
resolvePackage() {
  local target="${1:-}"
  case "$target" in
    lb)        echo "@backpressure/lb" ;;
    sidecar)   echo "@backpressure/sidecar" ;;
    generator) echo "@backpressure/generator" ;;
    web)       echo "@backpressure/web" ;;
    *)
      echo "Error: Unknown target '$target'." >&2
      echo "Valid targets: lb, sidecar, generator, web" >&2
      exit 1
      ;;
  esac
}

## Checks if Docker is running and attempts to start it on macOS if not.
ensureDocker() {
  if docker info &>/dev/null; then
    return 0
  fi

  echo "Docker is not running. Attempting to start..."
  if [[ "$(uname)" == "Darwin" ]]; then
    open -a Docker
    echo "Waiting for Docker to start..."
    local retries=30
    while ! docker info &>/dev/null && (( retries > 0 )); do
      sleep 2
      (( retries-- ))
    done

    if ! docker info &>/dev/null; then
      echo "Error: Docker failed to start within 60 seconds." >&2
      exit 1
    fi
    echo "Docker is running."
  else
    echo "Error: Docker is not running. Please start Docker and try again." >&2
    exit 1
  fi
}

## Brings up all Docker containers defined in docker-compose.yml.
cmdUp() {
  ensureDocker
  docker compose -f "$SCRIPT_DIR/docker-compose.yml" up -d --build
}

## Brings down all Docker containers.
cmdDown() {
  docker compose -f "$SCRIPT_DIR/docker-compose.yml" down
}

## Builds the specified target package using TypeScript compiler.
## @param $1 - Target package name (lb, sidecar, generator, web).
cmdBuild() {
  local pkg
  pkg=$(resolvePackage "${1:-}")
  echo "Building $pkg..."
  npm run build -w "$pkg"
}

## Runs the ESLint linter on the specified target package.
## @param $1 - Target package name (lb, sidecar, generator, web).
cmdLint() {
  local pkg
  pkg=$(resolvePackage "${1:-}")
  echo "Linting $pkg..."
  npm run lint -w "$pkg"
}

## Runs unit tests for the specified target package using vitest.
## @param $1 - Target package name (lb, sidecar, generator, web).
cmdTest() {
  local pkg
  pkg=$(resolvePackage "${1:-}")
  echo "Testing $pkg..."
  npm run test -w "$pkg"
}

## Main dispatch function. Routes the first argument to the appropriate subcommand.
main() {
  local cmd="${1:-help}"
  shift || true

  case "$cmd" in
    up)    cmdUp "$@" ;;
    down)  cmdDown "$@" ;;
    build) cmdBuild "$@" ;;
    lint)  cmdLint "$@" ;;
    test)  cmdTest "$@" ;;
    help)  usage ;;
    *)
      echo "Error: Unknown command '$cmd'." >&2
      usage
      exit 1
      ;;
  esac
}

main "$@"
