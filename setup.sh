#!/usr/bin/env bash
# setup.sh - Installs all dependencies required to build and run the project.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

## Checks if a command is available on the system PATH.
## @param $1 - The command name to check.
## @returns 0 if the command exists, 1 otherwise.
checkCommand() {
  if ! command -v "$1" &>/dev/null; then
    echo "Error: '$1' is not installed. Please install it and try again."
    return 1
  fi
}

## Verifies that Node.js is installed and prints the version.
checkNode() {
  checkCommand "node"
  echo "Found Node.js $(node --version)"
}

## Installs all project dependencies using npm.
installDeps() {
  echo "Installing project dependencies..."
  cd "$SCRIPT_DIR"
  npm install
}

## Main entry point. Validates prerequisites and installs dependencies.
main() {
  echo "=== Backpressure Simulation Setup ==="
  checkNode
  installDeps
  echo "=== Setup complete ==="
}

main "$@"
