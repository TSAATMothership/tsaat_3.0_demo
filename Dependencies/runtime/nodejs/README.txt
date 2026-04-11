Bundled Node.js Runtime (Windows x64)
=====================================

Purpose
-------
This repository vendors a portable Node.js runtime so `compileApp.cmd` can run
fully offline on Windows without requiring a machine-level Node.js install.

Runtime path used by compile scripts
------------------------------------
Dependencies\runtime\nodejs\win-x64
Required npm payload path: Dependencies\runtime\nodejs\win-x64\node_modules\npm\bin\npm-cli.js

Included runtime version
------------------------
Node.js: v24.13.1
npm:     11.8.0

Update process
--------------
1. Replace the contents of `Dependencies\runtime\nodejs\win-x64` with the new
   Windows x64 Node.js distribution files.
2. Re-run `compileApp.cmd` to validate the runtime and offline app build.
3. Update `Dependencies\application dependencies.txt` and `README.md` if build
   requirements or versions changed.
