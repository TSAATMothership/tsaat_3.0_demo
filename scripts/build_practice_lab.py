"""Package the compiled sibling TSAAT NoSQL app with a fresh copy of its sample data."""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path

from build_guide import ROOT, GUIDE, build

RELEASE = "TSAAT-Practice-Lab-Windows-x64.zip"


def read_json(file):
    return json.loads(file.read_text(encoding="utf-8-sig"))


def copy(file, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(file, dest)


def copy_packages(source, target):
    visited = set()
    pending = [source / "node_modules" / name for name in ("next", "react", "react-dom", "clsx", "pdf-lib")]
    while pending:
        package = pending.pop()
        if package in visited:
            continue
        visited.add(package)
        shutil.copytree(package, target / package.relative_to(source), ignore=shutil.ignore_patterns("node_modules", "*.map"), dirs_exist_ok=True)
        meta = read_json(package / "package.json")
        names = set(meta.get("dependencies", {}))
        names.update(set(meta.get("optionalDependencies", {})) & {"@next/swc-win32-x64-msvc", "@img/sharp-win32-x64", "sharp"})
        for name in sorted(names):
            candidates = (parent / "node_modules" / name for parent in (package, *package.parents) if parent.is_relative_to(source))
            dependency = next((p for p in candidates if (p / "package.json").is_file()), None)
            if dependency is None:
                raise RuntimeError(f"Missing runtime dependency {name} for {package.name}")
            pending.append(dependency)


def stage_application(source, target):
    compiled = source / ".next-nosql"
    if not (compiled / "BUILD_ID").is_file():
        raise FileNotFoundError(f"Build the NoSQL application first in {source}")
    dest = target / ".next-nosql"
    for name in ("server", "static"):
        shutil.copytree(compiled / name, dest / name, ignore=shutil.ignore_patterns("*.map", "*.nft.json"))
    for file in compiled.iterdir():
        if file.is_file() and (file.name == "BUILD_ID" or file.suffix == ".json" and not file.name.endswith(".nft.json")):
            copy(file, dest / file.name)
    manifest = dest / "required-server-files.json"
    config = read_json(manifest)
    if config["config"].get("distDir") != ".next-nosql":
        raise ValueError("Unexpected compilation target")
    config.update(appDir=".", relativeAppDir="")
    for conf in (config["config"], config["config"].get("experimental", {})):
        if "outputFileTracingRoot" in conf:
            conf["outputFileTracingRoot"] = "."
    manifest.write_text(json.dumps(config, separators=(",", ":")), encoding="utf-8")
    copy(source / "next.config.mjs", target / "next.config.mjs")
    shutil.copytree(source / "public", target / "public")
    (target / "package.json").write_text('{"name":"tsaat-practice-runtime","private":true}\n', encoding="utf-8")
    copy_packages(source, target)
    for trace in compiled.rglob("*.nft.json"):
        for entry in read_json(trace)["files"]:
            dep = (trace.parent / entry).resolve()
            if dep.is_relative_to(source / "node_modules") and dep.is_file() and dep.suffix != ".map":
                dest = target / dep.relative_to(source)
                if not dest.exists():
                    copy(dep, dest)


def stage_runtime_and_data(source, stage):
    spec = read_json(source / "scripts" / "offline-runtime.json")
    archive = source / "runtime" / spec["archive"]
    if hashlib.sha256(archive.read_bytes()).hexdigest() != spec["sha256"]:
        raise ValueError("Node runtime archive differs from the companion application's manifest")
    with zipfile.ZipFile(archive) as bundle:
        (stage / "runtime").mkdir()
        for filename in ("node.exe", "LICENSE"):
            with bundle.open(spec["directory"] + "/" + filename) as inp, (stage / "runtime" / filename).open("wb") as out:
                shutil.copyfileobj(inp, out)
    sample = stage / "sample-data"
    env = dict(os.environ, TSAAT_JSON_DATA_DIR=str(sample))
    subprocess.run([str(stage / "runtime" / "node.exe"), str(source / "scripts" / "setup-json-store.mjs")], cwd=source, env=env, check=True)
    manifest = read_json(sample / "store.json")
    if manifest.get("sampleDataProfile") != "tsaat-aligned-evidence-v1" or len(manifest["snapshots"]) != 8:
        raise ValueError("Expected the eight-snapshot TSAAT training dataset")


def package(source):
    if os.name != "nt":
        raise SystemExit("Package the Windows x64 practice lab on Windows.")
    source = source.resolve()
    # The standalone guide can be built without the companion application.
    build()
    releases = ROOT / "releases"
    releases.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="tsaat-lab-") as directory:
        stage = Path(directory)
        stage_application(source, stage / "application")
        stage_runtime_and_data(source, stage)
        for name in ("TSAAT-User-Guide.html", "TSAAT-Guide-Text.xlsx"):
            copy(GUIDE / name, stage / name)
        for name in ("Start Practice Lab.cmd", "lab-host.cjs"):
            copy(ROOT / "practice-lab" / name, stage / name)
        with tempfile.NamedTemporaryFile(dir=releases, suffix=".partial", delete=False) as tmp:
            output = Path(tmp.name)
        try:
            with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED, compresslevel=5) as archive:
                for item in sorted(stage.rglob("*")):
                    if item.is_file():
                        if item.name.lower() in {"db_config", "logindetails", ".env"}:
                            raise ValueError(f"Unexpected configuration in package: {item.name}")
                        archive.write(item, item.relative_to(stage).as_posix())
            output.replace(releases / RELEASE)
        finally:
            output.unlink(missing_ok=True)
    print(f"Built {releases / RELEASE}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app-source", type=Path, default=ROOT.parent / "DSMR_TSAAT", help="Built TSAAT source checkout; defaults to the sibling DSMR_TSAAT folder.")
    package(parser.parse_args().app_source)

