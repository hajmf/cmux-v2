# Building and testing

## Source-only tests

Run `./scripts/run-host-tests.sh` with Python 3 and a C++17 compiler. These model
tests do not require a Chromium checkout. Shell and Python regression tests in
`scripts/test-*` cover individual build, packaging, and release components.

## Linux release build

Use `scripts/bootstrap-release-linux.sh` to prepare dependencies; consult
`docs/releases.md` for its requirements and pinned source closure. The build
requires a prepared Chromium checkout and matching GN configuration, pinned
Ghostty and cmux-tui artifacts, depot_tools, Zig, Rust, and packaging tools.
Downloads and warm build outputs should live outside this Git checkout.

On a prepared local builder:

```sh
export CMUX_LINUX_BUILD_ROOT=/absolute/path/to/warm-build
export CHROMIUM_SRC="$CMUX_LINUX_BUILD_ROOT/chromium/src"
export CMUX_DEPOT_TOOLS="$CMUX_LINUX_BUILD_ROOT/depot_tools"
export CMUX_RELEASE_OUTPUT=/absolute/path/to/release-output
export CMUX_RELEASE_VERSION=151.0.7922.64
export CMUX_RELEASE_CHANNEL=nightly
export CMUX_RELEASE_SOURCE_SHA="$(git rev-parse HEAD)"
./scripts/build-release-linux.sh
```

The release script modifies the Chromium checkout and reuses `out/Release`.
When several source worktrees use the same builder, serialize the complete
sync/apply/compile/package operation with an external lock. Git worktrees alone
do not isolate that mutable build directory. Avoid manual edits in the builder:
source changes belong in `overlay/` and `patches/`.

The upstream split compile/package interface identifies a build by commit,
version, and channel. A local shared-builder wrapper must also account for dirty
source, dependency pins, and build configuration before accepting a receipt.

## Worktrees

```sh
git worktree add -b task/example ../cmux-v2-worktrees/example HEAD
# When the task is finished and its changes are saved:
git worktree remove ../cmux-v2-worktrees/example
```

Keep compiler installations, dependency downloads, and build outputs outside
these worktrees. Agent instructions and machine-specific wrappers are optional
local integrations and must not be added to the public source archive.

## Other platforms and upstream automation

The portable macOS and Windows scripts are retained. macOS deployment verifies
the `out/Release/cmux.app` bundle identity before installation. Historical
upstream release workflow definitions are in `docs/upstream-workflows/` with
`.disabled` suffixes. They describe upstream infrastructure and require explicit
adaptation before activation in this fork.
