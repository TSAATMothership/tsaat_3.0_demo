"""Build and package the browser-only TSAAT practice app and offline guide."""
import argparse
import subprocess
import tempfile
import zipfile
from pathlib import Path

from build_guide import ROOT, GUIDE, build


def package(source):
    subprocess.run(['node', str(ROOT / 'scripts/build_browser_lab.mjs'), '--app-source', str(source.resolve())], cwd=ROOT, check=True)
    build()
    releases = ROOT / 'releases'
    releases.mkdir(exist_ok=True)
    target = releases / 'TSAAT-Practice-Lab-Browser.zip'
    with tempfile.NamedTemporaryFile(dir=releases, suffix='.partial', delete=False) as temp:
        output = Path(temp.name)
    try:
        with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for name in ('TSAAT-User-Guide.html', 'TSAAT-Practice-Lab.html', 'TSAAT-Guide-Text.xlsx'):
                archive.write(GUIDE / name, name)
            archive.write(ROOT / 'practice-lab/source-manifest.json', 'source-manifest.json')
            archive.write(ROOT / 'practice-lab/README.md', 'README.md')
            archive.write(ROOT / 'practice-lab/THIRD-PARTY-NOTICES.txt', 'THIRD-PARTY-NOTICES.txt')
            archive.write(ROOT / 'vendor/jszip/LICENSE.markdown', 'JSZip-LICENSE.markdown')
        output.replace(target)
    finally:
        output.unlink(missing_ok=True)
    print(f'Built {target}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--app-source', type=Path, default=ROOT.parent / 'DSMR_TSAAT', help='TSAAT source checkout with its installed offline dependencies.')
    package(parser.parse_args().app_source)
