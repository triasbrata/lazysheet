# Pending release notes (next tag) 

Paste relevant bullets into the **annotated tag message** when cutting the next
release — `release.yml` derives the changelog from the tag annotation, not from
this file. This file is just a holding area so nothing gets forgotten.

## Performance

- **Large spreadsheets open much faster.** A ~71k-cell `.xlsx` that previously
  took around 3 seconds to open now loads in well under a second. Only the
  visible sheet is parsed up front (via lazy reading), so switching sheets no
  longer re-parses the entire workbook.

- **The app is much smaller.** The installed app shrinks from ~25 MB to
  ~10 MB, making downloads and updates faster.

<!--
Engineering detail (not for user-facing notes):
Binary size: added [profile.release] (opt-level="s", lto=true,
codegen-units=1, strip=true, panic="abort") to src-tauri/Cargo.toml.
macOS arm64 binary 23.7MB -> 8.5MB.
-->

<!--
Engineering detail (not for user-facing notes):
Rust-side parse measured on the real 71.5k-cell file:
  before: read 1040ms + transform 50ms = ~1090ms
  after:  read 95ms + deserialize 31ms + transform 21ms = ~147ms  (~7.4x)
Fixes: lazy_read + read_sheet(index); [profile.dev.package."*"] opt-level=3;
HashMap column/row dimension lookups. Commit d1ebca0 (reapplied as 787599f).
-->
