#!/usr/bin/env python
from __future__ import annotations
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []

for rel in [".hermes.md", "AGENTS.md", ".pi/AI_SETUP.md"]:
    path = ROOT / rel
    if not path.exists():
        errors.append(f"missing {rel}")
    elif rel in [".hermes.md", "AGENTS.md"] and path.stat().st_size > 20_000:
        errors.append(f"{rel} is too large for always-loaded context: {path.stat().st_size} bytes")

skill_root = ROOT / "skills"
if not skill_root.exists():
    errors.append("missing canonical skills/ directory")
else:
    for skill in sorted(skill_root.glob("*/SKILL.md")):
        text = skill.read_text(encoding="utf-8")
        if not text.startswith("---") or "\n---\n" not in text[3:]:
            errors.append(f"{skill.relative_to(ROOT)} invalid frontmatter")
        if len(text) > 100_000:
            errors.append(f"{skill.relative_to(ROOT)} too large")


required_skills = {
    "vibe-project", "vertical-slice-planner", "vibe-ui-architecture", "canvas-engine",
    "knowledge-graph", "mechanics-engine", "dynamic-forms", "multiplayer-sync",
    "self-critique", "test-generator", "frontend-design",
}
if skill_root.exists():
    present = {p.parent.name for p in skill_root.glob("*/SKILL.md")}
    missing = sorted(required_skills - present)
    if missing:
        errors.append(f"missing canonical skills: {', '.join(missing)}")

for legacy_rel in [".pi/skills", ".opencode/skills", ".agents/skills"]:
    legacy_root = ROOT / legacy_rel
    if legacy_root.exists():
        for skill in legacy_root.glob("*/SKILL.md"):
            text = skill.read_text(encoding="utf-8", errors="replace")
            if "Compatibility stub" not in text and "Compatibility forwarding stub" not in text:
                errors.append(f"legacy skill is not a forwarding stub: {skill.relative_to(ROOT)}")

secret_patterns = [
    re.compile(r"sk-[A-Za-z0-9_-]{12,}"),
    re.compile(r"API_KEY\"\s*:\s*\"(?!\$\{)[^\"]{8,}\""),
]
for rel in ["opencode.jsonc", "opencode.example.jsonc", ".codex/hooks.json"]:
    path = ROOT / rel
    if path.exists():
        text = path.read_text(encoding="utf-8", errors="replace")
        for pat in secret_patterns:
            if pat.search(text):
                errors.append(f"possible literal secret in {rel}")

def strip_jsonc_comments(text: str) -> str:
    out: list[str] = []
    in_string = False
    escape = False
    i = 0
    while i < len(text):
        ch = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""
        if in_string:
            out.append(ch)
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            i += 1
            continue
        if ch == '"':
            in_string = True
            out.append(ch)
            i += 1
            continue
        if ch == "/" and nxt == "/":
            while i < len(text) and text[i] not in "\r\n":
                i += 1
            continue
        out.append(ch)
        i += 1
    return "".join(out)


def parse_jsonc(rel: str) -> None:
    path = ROOT / rel
    if not path.exists():
        return
    text = strip_jsonc_comments(path.read_text(encoding="utf-8"))
    text = re.sub(r",\s*([}\]])", r"\1", text)
    try:
        json.loads(text)
    except Exception as exc:
        errors.append(f"{rel} is not parseable JSON/JSONC: {exc}")

parse_jsonc("opencode.jsonc")
parse_jsonc("opencode.example.jsonc")
parse_jsonc(".codex/hooks.json")

opencode_path = ROOT / "opencode.jsonc"
if opencode_path.exists():
    opencode_text = strip_jsonc_comments(opencode_path.read_text(encoding="utf-8"))
    opencode_text = re.sub(r",\s*([}\]])", r"\1", opencode_text)
    try:
        opencode_data = json.loads(opencode_text)
        if "context-mode" not in opencode_data.get("mcp", {}):
            errors.append("context-mode MCP missing from opencode.jsonc")
    except Exception:
        pass

if errors:
    print("AGENT CONFIG VALIDATION FAILED")
    for error in errors:
        print("-", error)
    sys.exit(1)
print("AGENT_CONFIG_OK")
