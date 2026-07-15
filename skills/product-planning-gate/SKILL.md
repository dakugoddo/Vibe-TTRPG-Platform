---
name: product-planning-gate
description: "Use when the owner sends ideas, references, feature wishes, bug reports, or asks what to build next. Critically evaluates product value, detects ambiguity and conflicts, asks decision-quality questions, and routes accepted work into the project Markdown planning vault before vertical-slice implementation."
version: 1.0.0
author: Vibe TTRPG Platform
license: MIT
metadata:
  hermes:
    tags: [vibe-ttrpg, planning, product-gate, idea-intake, owner-questions]
    related_skills: [vertical-slice-planner, self-critique]
---

# Product Planning Gate

## Overview

The owner is the product-idea generator and domain authority, not the person responsible for translating every idea into a safe software architecture. Treat every substantive input seriously, but do **not** agree automatically and do not start coding merely because an idea sounds exciting.

This skill owns the path:

`raw input → understood problem → critical assessment → owner decision when needed → accepted roadmap item`

`vertical-slice-planner` starts only after this gate produces an accepted outcome.

## When to use

Load this skill when:

- the owner proposes a feature, redesign, workflow, integration, module, mechanic, or reference product;
- the owner sends a long document, screenshot set, video, external link, brainstorm, or mixed bundle of requests;
- a bug report may actually be a missing feature or misunderstood behavior;
- choosing the next roadmap slice;
- updating `.pi/DEVELOPMENT_PLAN.md` or `.pi/planning/*`.

Do not use it for a narrowly specified implementation whose product behavior and architecture were already approved. Use `vertical-slice-planner` for that.

## Canonical files

- Human roadmap: `.pi/DEVELOPMENT_PLAN.md`
- Intake and evaluated ideas: `.pi/planning/IDEAS.md`
- Active bugs and QA: `.pi/planning/BUGS.md`
- Owner decisions/questions: `.pi/planning/QUESTIONS.md`
- Completed next-release work: `.pi/planning/NEXT_RELEASE.md`
- Detailed contracts: `.pi/docs/*.md`

Do not recreate full feature/bug descriptions in legacy `.pi/FEATURE_BACKLOG.md` or `.pi/BUG_BACKLOG.md`; they are compatibility pointers.

## Step 1 — Preserve the owner's meaning

Write a compact intake record before interpreting it:

- **What the owner asked for** — plain-language paraphrase.
- **Why they appear to want it** — user pain/value, marked as an assumption if not explicit.
- **Source** — conversation, document, screenshot, URL, QA observation.
- **Scope signals** — modules, roles, devices, multiplayer, data.

Do not silently narrow, embellish, or split the idea yet.

Completion criterion: the owner could read the record and say “yes, that is what I meant.”

## Step 2 — Ask the internal planning questions

Answer these before adding implementation work:

### User value

1. Who experiences the problem: GM, player, both, campaign author, mod author?
2. What concrete action becomes faster, safer, clearer, or newly possible?
3. Is this a recurring real workflow or an attractive demo/internal capability?
4. What visible result proves value to a non-programmer?

### Existing product fit

5. Does the behavior already exist but lack discoverability or contain a bug?
6. Can it extend an existing model/service/UI instead of creating a parallel system?
7. Does it support the local-first VTT + Markdown knowledge-base identity?
8. Is it core, an optional built-in module, a future mod/data pack, or out of scope?

### Cost and risk

9. Does it touch `.md` storage, Yjs/session sync, permissions/privacy, world files, migration, Electron packaging, or performance-sensitive canvas code?
10. Could failure lose data, expose GM information, desync clients, corrupt a world, or make existing worlds incompatible?
11. Does it require a dependency, external service, account, paid API, or network availability?
12. What must remain backward compatible?

### UX and design

13. Where does the user naturally look for this action?
14. Is the idea about behavior, appearance, or both?
15. Does it work in narrow layouts, all themes/densities, keyboard flow, and read-only/player states?
16. Is a reference product being used as behavioral inspiration or mistakenly copied as a visual template?

### Planning quality

17. What is the smallest end-to-end slice with real user value?
18. What tempting infrastructure is YAGNI until a real consumer exists?
19. What evidence/test/manual smoke proves the slice?
20. What information is still unknown, and does it materially change the result?

Completion criterion: every question is answered, explicitly marked “not relevant,” or converted into an owner question.

## Step 3 — Challenge the idea

Assign one disposition and explain why in plain Russian:

- **Принять** — useful, coherent, and safe enough to plan.
- **Уточнить** — valuable idea, but owner choice changes product behavior/architecture.
- **Отложить** — reasonable, but prerequisites or current priorities make it premature.
- **Объединить** — belongs to an existing feature/bug rather than a new system.
- **Отклонить** — harms clarity/security/performance, duplicates functionality, or conflicts with product direction.

Critical feedback is mandatory when warranted. Use this pattern:

> Идея решает X, но предложенная форма создаёт Y. Рекомендую Z, потому что это сохраняет A и даёт тот же пользовательский результат. Альтернативу стоит выбирать только если для вас важнее B.

Do not hide disagreement behind technical jargon.

## Step 4 — Decide whether to ask the owner

Ask before implementation when any of these is true:

- main workflow or permanent UI placement changes;
- `.md`/world storage, Yjs, permissions/privacy, identity, plugin/mod API, platform or dependency changes;
- multiple viable options produce meaningfully different UX;
- design choice is subjective and not settled by existing theme/UX contracts;
- idea conflicts with an earlier owner decision;
- destructive or hard-to-migrate behavior is possible;
- acceptance criteria cannot be inferred without guessing.

Question format:

1. **Why this decision is needed** — one short paragraph.
2. **Options** — 2–4 concrete user-facing alternatives.
3. **Recommendation** — pick one and explain the tradeoff.
4. **What remains safe meanwhile** — research/tests/reversible foundation only.

Do not ask for low-impact implementation details the agent can decide safely.

## Step 5 — Route the outcome

- Raw/assessed idea → `IDEAS.md`.
- Confirmed defect or QA risk → `BUGS.md`.
- Unresolved owner fork → `QUESTIONS.md` and mark related roadmap item blocked.
- Accepted near-term outcome → a stage/slice in `DEVELOPMENT_PLAN.md`.
- Detailed architecture → `.pi/docs/<topic>.md`, linked from the idea/roadmap.
- Completed verified work → remove from active files and add to `NEXT_RELEASE.md`.

A large input-analysis task is itself a roadmap item when it requires research or decomposition. Example: “Разобрать 40-minute reference video and produce accepted/rejected behavior list” comes before implementation slices.

## Roadmap entry contract

Every active slice in `DEVELOPMENT_PLAN.md` must say:

- **Результат для пользователя** — what changes visibly.
- **Почему сейчас** — priority and dependency reason.
- **Что сделаем** — 2–5 plain-language steps.
- **Не входит** — YAGNI boundary.
- **Готово, когда** — observable acceptance criteria.
- **Риски/вопросы** — links to `BUGS.md`/`QUESTIONS.md` if any.

Avoid code file lists in the human roadmap. Put implementation details in a linked design doc or temporary execution plan.

## Completion and changelog protocol

A roadmap item or bug leaves active storage only when its acceptance checks pass.

Then:

1. Remove it from the active stage/bug list.
2. Add a plain-language entry to `NEXT_RELEASE.md` under `Добавлено`, `Изменено`, `Исправлено`, `Безопасность`, or `Документация`.
3. Preserve unfinished manual QA as an active `BUGS.md`/roadmap check; do not call it complete.
4. Keep technical lessons in the relevant skill/rule/design doc, not in the changelog.
5. At release time archive the file under a versioned release note and reset the next-release template.

## Common pitfalls

1. **Automatic agreement.** “Good idea” is not analysis. State value, conflict, risk, and disposition.
2. **Coding before deciding.** A prototype can accidentally freeze architecture. Ask first when the fork matters.
3. **Backlog duplication.** One full record, links elsewhere.
4. **Technical roadmap.** The owner needs outcomes and rationale, not component names.
5. **History in active context.** Completed work belongs in `NEXT_RELEASE.md`.
6. **Ignoring submitted material.** Record an analysis task and process every meaningful claim; do not cherry-pick only easy parts.
7. **Question spam.** Group related high-impact decisions; decide safe low-impact details autonomously.
8. **Internal demo slices.** A slice must deliver production behavior or remove a concrete user risk.

## Verification checklist

- [ ] Owner input preserved accurately.
- [ ] User problem and affected role identified.
- [ ] Existing implementation/backlog/docs checked.
- [ ] Product fit, module classification, cost, and failure risk assessed.
- [ ] Idea disposition recorded with a plain-language reason.
- [ ] Material product/architecture/design forks were asked, not guessed.
- [ ] Accepted work has the smallest visible slice and explicit non-goals.
- [ ] Each active record exists fully in one place only.
- [ ] Completed work moved to `NEXT_RELEASE.md`.
- [ ] Roadmap remains readable by an advanced non-programmer.
