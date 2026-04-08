# Sourcecode Mirror

This folder is reserved for clear-text source required to compile TSAAT without internet access.

Expected structure:

- `project/` - mirrored repository source files.
- `node_modules/` - mirrored npm dependency source files.
- `MANIFEST.txt` - generated metadata (timestamp + source paths).

Generate/update this mirror with:

```powershell
powershell -ExecutionPolicy Bypass -File .\Dependencies\sync-sourcecode.ps1
```
