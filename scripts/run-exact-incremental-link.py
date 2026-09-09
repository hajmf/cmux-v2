#!/usr/bin/env python3
"""Rebuild one pinned Chromium object and relink chrome without graph traversal."""

import argparse
import os
from pathlib import Path
import re
import subprocess
import sys


VAR = re.compile(r"\$\{([A-Za-z0-9_]+)\}|\$([A-Za-z0-9_]+)")


def assignments(lines):
    result = {}
    for line in lines:
        match = re.match(r"^(?:  )?([A-Za-z0-9_]+) = (.*)$", line)
        if match:
            result[match.group(1)] = match.group(2)
    return result


def expand(value, values):
    for _ in range(20):
        changed = False

        def replace(match):
            nonlocal changed
            name = match.group(1) or match.group(2)
            changed = True
            return values.get(name, "")

        new_value = VAR.sub(replace, value)
        if not changed or new_value == value:
            return new_value.replace("$$", "\0").replace("$ ", " ").replace("$:", ":").replace("\0", "$")
        value = new_value
    raise ValueError("Ninja variable expansion did not converge")


def rule_values(toolchain, expected_rule):
    lines = toolchain.read_text().splitlines()
    start = lines.index(f"rule {expected_rule}") + 1
    end = next((i for i in range(start, len(lines)) if lines[i] and not lines[i].startswith("  ")), len(lines))
    values = assignments(lines[start:end])
    if "command" not in values:
        raise ValueError(f"rule {expected_rule} has no command")
    return values


def edge_values(path, expected_output, expected_rule):
    lines = path.read_text().splitlines()
    prefix = f"build {expected_output}: {expected_rule} "
    indexes = [i for i, line in enumerate(lines) if line.startswith(prefix)]
    if len(indexes) != 1:
        raise ValueError(f"expected exactly one {expected_output} {expected_rule} edge; found {len(indexes)}")
    index = indexes[0]
    edge = lines[index][len(prefix):]
    # Ninja's special $in variable contains explicit inputs only. Implicit (`|`)
    # and order-only (`||`) dependencies affect scheduling but not the command.
    inputs = edge.split(" || ", 1)[0].split(" | ", 1)[0]
    if not inputs.strip():
        raise ValueError(f"edge {expected_output} has no inputs")
    # GN emits target-wide bindings before its first edge and source-specific
    # bindings after each object edge. The latest binding before this edge is
    # therefore the applicable file scope; immediate indented bindings below
    # the edge override it.
    scope = assignments(lines[:index])
    edge_end = next((i for i in range(index + 1, len(lines))
                     if lines[i] and not lines[i].startswith("  ")), len(lines))
    edge_scope = assignments(lines[index + 1:edge_end])
    scope.update(edge_scope)
    scope.update({"in": inputs, "out": expected_output})
    return scope


def exact_command(toolchain, edge_file, output, rule):
    values = edge_values(edge_file, output, rule)
    rule = rule_values(toolchain, rule)
    values.update({key: expand(value, values) for key, value in rule.items()})
    command = expand(rule["command"], values)
    rsp_path = expand(rule.get("rspfile", ""), values)
    rsp_content = expand(rule.get("rspfile_content", ""), values)
    return command, rsp_path, rsp_content


def run(command, cwd, log):
    with log.open("wb") as output:
        process = subprocess.run(["/bin/sh", "-c", command], cwd=cwd, stdout=output,
                                 stderr=subprocess.STDOUT)
    if process.returncode:
        raise subprocess.CalledProcessError(process.returncode, command)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--log-dir", required=True, type=Path)
    parser.add_argument("--inspect-only", action="store_true")
    args = parser.parse_args()
    out = args.out.resolve()
    log_dir = args.log_dir.resolve()
    log_dir.mkdir(parents=True, exist_ok=True)
    toolchain = out / "toolchain.ninja"
    object_path = Path("obj/chrome/browser/core/cmux_views.o")
    chrome_path = Path("chrome")
    object_command, object_rsp, _ = exact_command(
        toolchain, out / "obj/chrome/browser/core.ninja", str(object_path), "cxx")
    link_command, link_rsp, link_rsp_content = exact_command(
        toolchain, out / "obj/chrome/chrome_initial.ninja", "./chrome", "link")
    if object_rsp:
        raise ValueError("cmux_views cxx edge unexpectedly uses a response file")
    if link_rsp != "./chrome.rsp":
        raise ValueError(f"unexpected chrome response file: {link_rsp}")
    if str(object_path) not in link_rsp_content.split():
        raise ValueError("chrome link response does not contain cmux_views.o")
    (log_dir / "incremental-object-command.log").write_text(object_command + "\n")
    (log_dir / "incremental-link-command.log").write_text(link_command + "\n")
    (log_dir / "incremental-link-input-count.log").write_text(
        f"{len(link_rsp_content.split())}\n")
    if args.inspect_only:
        return

    backups = []
    try:
        for relative in (object_path, chrome_path):
            source = out / relative
            if not source.is_file():
                raise ValueError(f"baseline output missing: {source}")
            backup = log_dir / (relative.name + ".baseline-backup")
            backup.unlink(missing_ok=True)
            subprocess.run(["cp", "--reflink=auto", "--preserve=mode,timestamps",
                            source, backup], check=True)
            backups.append((source, backup))
        run(object_command, out, log_dir / "incremental-object-build.log")
        rsp = out / "chrome.rsp"
        rsp.write_text(link_rsp_content)
        try:
            run(link_command, out, log_dir / "incremental-link-build.log")
        finally:
            rsp.unlink(missing_ok=True)
    except Exception:
        for output, backup in backups:
            if backup.exists():
                os.replace(backup, output)
        raise
    finally:
        for _, backup in backups:
            backup.unlink(missing_ok=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"exact incremental link failed: {exc}", file=sys.stderr)
        raise
