# Who Writes the Rules for AI? — instructions for agents

A browser game that simulates an international AI-safety summit (course project, POL3610J A3).
Read `docs/IMPLEMENTATION-PLAN.md` (what to build) and `docs/DESIGN.md` (game design, v0.3) before substantive work.

## Commands

```
npm ci               # install
npm run dev          # dev server with hot reload (also reloads on YAML edits)
npm run typecheck    # tsc --noEmit, strict
npm test             # vitest: engine, llm, config, full-game simulation
npm run check-config # validate /config only
npm run build        # dist/ for GitHub Pages
npm run build:single # release/who-writes-the-rules.html, opens from file://
```

A change is not done until `npm run typecheck` and `npm test` pass.

## Hard rules

- **Rules live in code, not in the model.** Attendance, speaker selection, red lines, must-haves, softening,
  votes and outcomes are pure functions in `src/engine`. Model output is validated and clamped; it never decides.
- **`src/engine` is pure**: no DOM, no `fetch`, no `Date.now()`/`Math.random()` inside rule functions
  (time and seed come in as arguments). Same seed + same inputs = same result.
- **The game must always run without a network or an API key.** Every model call has a mock fallback.
- **Static app, no backend.** Hash routing only. No external fonts, scripts or images: the single-file
  build has to open from `file://` offline.
- **Contract files are frozen**: `src/engine/types.ts`, `src/llm/types.ts`, `src/game/api.ts`,
  `src/game/context.tsx`. Screens use only the hooks in `src/game/context.tsx` and never import the engine.
  Need a contract change? Report it to the lead; do not edit.
- **Public repository.** No API keys, tokens, personal names, emails or local machine paths in any file.
  Team members are referred to by handle or initials only.
- **UI text is English.** The language AI delegates speak is `scenario.ai_language`.
- **Dependencies stay minimal**: React, zod, js-yaml, Vite, Vitest. Ask the lead before adding one.
- Every game rule is a claim about the real world. Config items carry `source_ids` pointing at `claims`;
  unknowns are listed under `research` in the same file, never invented.

## Layout and ownership

| Path | Contents |
| --- | --- |
| `config/` | All game content as YAML. One file per delegation, including its claims and research needs |
| `config/prompts/` | Prompt templates with `{{var}}` placeholders |
| `src/engine/` | Config schema + loader, condition matcher, attendance, responders, clauses, softening, voting, outcome, counterfactuals |
| `src/llm/` | OpenAI-compatible client (mock / direct / proxy), role functions, mock generator |
| `src/game/` | Controller that sequences engine + model calls, persistence, providers |
| `src/platform/` | Local gallery, ratings, Bayesian ranking, CSV/JSON export |
| `src/ui/` | Screens, components, styles. `src/ui/dev/` holds fixtures for building screens in isolation |
| `tests/` | Vitest suites |
| `tools/` | `llm-proxy.mjs` (optional local proxy), build helpers |

When several agents work at once, each stays inside the directories it was assigned and works in its own git worktree.

## Config conventions

- Condition DSL (`when:`) is defined by `ClauseCond` and `ConveneCond` in `src/engine/types.ts`. Nothing else is supported.
- Every red line, must-have, attendance condition and walkout trigger has a `say:` sentence. The mock model
  speaks from it and the debrief shows it, so write it as the delegation would say it.
- Claim ids are globally unique: `C-<DELEGATION SHORT>-NN` (e.g. `C-CN-03`), `C-GEN-NN` for general ones.
- Research need ids: `R-<DELEGATION SHORT>-NN`.
