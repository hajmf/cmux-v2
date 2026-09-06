# cmux Browser — source development

This fork contains the cmux Browser source overlay, Chromium patches, portable
build scripts, tests, and licensing metadata. It starts from the corresponding
source archive for version `151.0.7922.64` and includes local Linux terminal fixes.
The archive's original provenance is retained in `SOURCE-MANIFEST.json`; it is
not a claim that later local builds match the original upstream commit.

## Layout

- `overlay/`: browser and terminal sources mirrored into Chromium.
- `patches/`: changes applied to the pinned Chromium checkout.
- `scripts/`, `tests/`, `tools/`: build, packaging, and verification tools.
- `packaging/`, `release-compliance/`, `third_party/`: packaging inputs and notices.
- `docs/`: architecture, build instructions, and upstream reference material.

Start with [building and testing](docs/building.md). A clone contains source
inputs; Chromium, compilers, caches, and packaged binaries live outside Git.
Personal automation and agent instructions belong in a separate private
repository and are not required to use this source repository.

The original [distribution README](docs/distribution/README.md) describes the
upstream download service. This fork does not publish that service's releases.
Upstream workflow definitions are retained as inactive references under
`docs/upstream-workflows/`; they are not installed as GitHub Actions workflows.

## License and provenance

See [LICENSE](LICENSE), [COPYRIGHT.md](COPYRIGHT.md), and
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Independently authored cmux
material and imported components retain their original license terms. The
source archive's licenses and notices are preserved.
