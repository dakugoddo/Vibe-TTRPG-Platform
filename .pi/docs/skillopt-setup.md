# SkillOpt local setup

> Date: 2026-05-27.
> Purpose: record the local SkillOpt installation for future agents.

## Installation

SkillOpt was installed outside the Vibe project to avoid polluting the app workspace.

- Repository: `C:\tmp\SkillOpt`
- Virtual environment: `C:\tmp\skillopt-venv`
- Python: `3.12.11`
- Install mode: editable core install, no optional `alfworld`, `webui`, `qwen`, `claude`, or docs extras.

Commands used:

```powershell
git clone https://github.com/microsoft/SkillOpt.git C:\tmp\SkillOpt
python -m venv C:\tmp\skillopt-venv
C:\tmp\skillopt-venv\Scripts\python.exe -m pip install -e C:\tmp\SkillOpt
```

## Verified

```powershell
C:\tmp\skillopt-venv\Scripts\python.exe -c "import skillopt; print('skillopt import ok')"
C:\tmp\skillopt-venv\Scripts\skillopt-train.exe --help
C:\tmp\skillopt-venv\Scripts\skillopt-eval.exe --help
```

## Vibe Pilot Attempt 2026-05-27

Pilot files were created in `C:\tmp\vibe-skillopt`:

- `initial_skill.md`
- `vibe-searchqa-codex-eval.yaml`
- `split/train/items.json`
- `split/val/items.json`
- `split/test/items.json`

The pilot uses SkillOpt `searchqa` as a tiny smoke benchmark for Vibe agent workflow rules:

- command `продолжай`;
- bug intake into `.pi/planning/BUGS.md`;
- Architecture/Product gate for global features;
- local-first `.md` source of truth.

Command attempted:

```powershell
C:\tmp\skillopt-venv\Scripts\skillopt-eval.exe `
  --config C:\tmp\vibe-skillopt\vibe-searchqa-codex-eval.yaml `
  --skill C:\tmp\vibe-skillopt\initial_skill.md `
  --split all `
  --out_root C:\tmp\vibe-skillopt\outputs\eval-smoke-2
```

Result:

- SkillOpt loaded the split and completed the eval loop.
- All items failed because `codex_exec` could not launch Codex CLI from shell: `WinError 5 Access is denied`.
- Direct `codex --version` also fails with access denied. `where codex` points to the WindowsApps packaged Codex path:
  `C:\Program Files\WindowsApps\OpenAI.Codex_26.519.5221.0_x64__2p2nqsd0c76g0\app\resources\codex.exe`.

Additional local fix applied to the temporary SkillOpt checkout:

- `C:\tmp\SkillOpt\skillopt\envs\searchqa\rollout.py` was patched to open SearchQA output files with `encoding="utf-8"`.
- Without this, Windows cp1252 output crashed on Cyrillic task content.

## What Is Still Needed

SkillOpt is installed, but it is not automatically useful for this project yet.

To run optimization, it still needs:

- benchmark/task data split with `train`, `val`, and `test` JSON files;
- a config, usually from `C:\tmp\SkillOpt\configs\...`;
- model/API credentials or a supported local/backend setup;
- a target skill file to optimize, for example a future project skill derived from `.pi/skills/vibe-project/SKILL.md`.
- a shell-accessible Codex CLI path if using `target_backend=codex_exec`, or a different target backend.

Do not commit API keys or generated SkillOpt outputs into this repository unless the owner explicitly asks for a tracked experiment artifact.

Current blockers for real Vibe optimization:

1. No optimizer credentials are present in environment:
   - `OPENAI_API_KEY=False`
   - `AZURE_OPENAI_ENDPOINT=False`
   - `AZURE_OPENAI_API_KEY=False`
   - `ANTHROPIC_API_KEY=False`
   - `QWEN_CHAT_BASE_URL=False`
2. Packaged Codex CLI cannot be executed from shell because Windows denies access to the WindowsApps binary.

Potential next fixes:

- install or expose a shell-runnable Codex CLI and set `model.codex_exec_path` to it;
- or use direct `openai_chat`/Azure backend after setting credentials;
- then rerun the smoke eval before attempting `skillopt-train`;
- only after smoke eval passes, expand the Vibe benchmark from QA into coding/workflow tasks with real automated checks.

## Useful Commands

```powershell
C:\tmp\skillopt-venv\Scripts\skillopt-train.exe --help
C:\tmp\skillopt-venv\Scripts\skillopt-eval.exe --help
```

Optional WebUI was not installed. Official command if needed later:

```powershell
C:\tmp\skillopt-venv\Scripts\python.exe -m pip install -e "C:\tmp\SkillOpt[webui]"
C:\tmp\skillopt-venv\Scripts\python.exe -m skillopt_webui.app
```
