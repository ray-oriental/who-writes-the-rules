# UI design system

One page for anyone adding screens. The interface should feel like the paperwork and furniture of a
diplomatic conference: paper, ink, hairlines, serif documents. Not a chatbot, not a SaaS dashboard.

## Files

```
src/ui/
  App.tsx, App.css     shell: header, nav, PhaseBar strip, busy indicator, error banner, route switch
  router.ts            hash router: useRoute(), href(...parts), navigate(path)
  styles/tokens.css    every colour, size, duration (import nothing else for values)
  styles/base.css      reset, type roles (t-*), layout primitives (l-*), focus ring
  lib/delegations.ts   useDelegations(), hueVars(), cx(), listNames()
  components/          one .tsx + one .css per component (or small group)
  screens/             screens grouped by game phase or purpose
  dev/                 fixtures.ts, FixtureProviders.tsx, DevScreen.tsx (#/dev)
```

## Tokens (styles/tokens.css)

- Surfaces: `--paper` (page), `--paper-raised` (documents, inputs, cards), `--paper-sunk` (wells, hover, table top).
- Ink: `--ink` (navy; text and primary buttons), `--ink-2` secondary, `--ink-3` muted (still AA), `--ink-4` disabled/decorative only. `--on-ink` for text on ink.
- Lines: `--rule`, `--rule-strong`, shorthands `--hairline`, `--hairline-strong`.
- **Accent `--accent` (brass) is reserved for voting and decision moments**: the Convene button, Call vote, the vote reveal, the final outcome seal. Nowhere else.
- Status (muted): `--ok`, `--warn`, `--danger`, `--info`, each with a `-tint`.
- Delegations: `--deleg-1..8` + `-tint`, assigned **by seat order** (`useDelegations().get(id).hue`). Never by identity, never flags. Apply with `style={hueVars(hue)}`, then use `var(--d)` / `var(--d-tint)` in CSS.
- Type: `--font-sans` (interface), `--font-serif` (documents, titles), `--font-mono` (ids). Scale `--text-xs..3xl`.
- Space: `--space-1..8` on a 4px grid. Radius: `--radius-sm|radius|radius-lg`. Motion: `--dur-fast|dur|dur-slow`, `--ease`, all zeroed under `prefers-reduced-motion`.

## Naming

BEM. Components use a bare block name (`.button`, `.badge`, `.rt`, `.doc`); screens use the screen name
(`.convene__aside`, `.attendance__letter`). Modifiers `--x`. Utilities: `t-*` type roles
(`t-display`, `t-title`, `t-heading`, `t-eyebrow`, `t-lead`, `t-meta`, `t-num`), `l-*` layout
(`l-page`, `l-page--narrow|--wide`, `l-stack(--sm|--lg)`, `l-cluster`, `l-split`, `l-sticky`, `l-actions`),
`u-visually-hidden`. No inline styles except `hueVars()` and computed sizes.

## Components

| Component | Props (main) | Use it for |
| --- | --- | --- |
| `Button` | `variant: primary\|secondary\|quiet\|danger\|decision`, `size: sm\|md\|lg`, `icon`, `iconBefore` | One `primary` per step (its way forward). `decision` = accent, voting/commitment only. `quiet` for back/skip. |
| `IconButton` | `icon`, `label` (required, becomes aria-label) | Close buttons, toolbars. |
| `Icon` | `name`, `size` | Inline SVG set: close, check, arrows, chevron-down, alert, info, plus, minus, refresh, offline, lock. Add paths there; no icon library. |
| `DelegationBadge` | `id`, `withName`, `size`, `tone: tint\|solid\|muted` | Every mention of a delegation in UI chrome. `solid` for the player's own seat / active speaker. |
| `Section` | `number`, `title`, `aside`, `level: 2\|3` | Titled region with a hairline over its heading. Use instead of boxes. |
| `ScreenHead` | `eyebrow`, `title`, `lead`, `aside` | Top of every screen (holds the h1). |
| `Chip` | `tone`, `icon` | Status labels: outcome type, "offline fallback" (`warn` + `offline`), Track 2, tag hits. Never inside a button. |
| `Banner` | `tone: error\|warn\|info`, `title`, `onDismiss`, `actions` | Page-level messages. The shell already shows `view.error`. |
| `TypingDots` | `label` | "Delegation is typing" in the transcript. |
| `EmptyState` | `title`, `children`, `action` | Empty lists (gallery, clauses). |
| `Figure` | `value`, `label`, `tone` | Big serif number with caption ("4 of 6 / at the table"). |
| `Field` | `label`, `hint`, `error`, render-prop `children(id, describedBy)` | Label above any standalone control. |
| `Select` | `value`, `options`, `onChange(value)`, `placeholder` | Addressee dropdown, enum params. |
| `NumberInput` | `value`, `min`, `max`, `step`, `unit`, `onChange(number)` | Number clause params; clamps. |
| `TextArea` | native props | Player message, objections, comments, quiz. |
| `RadioCards` | `legend`, `options[{value,title,description,meta,leading,disabled,disabledReason}]`, `columns`, `onPreview` | Picking one of 2–6 described options. Disabled options show `disabledReason` with a lock. |
| `CheckboxList` | `legend`, `items[{value,label,note,leading}]`, `value[]` | Invite lists, multi-valued params. |
| `ScoreInput` | `label`, `value`, `onChange`, `anchors` | 1–5 ratings in the Gallery. |
| `Dialog` / `Drawer` | `open`, `onClose`, `title`, `footer` | Native `<dialog>` (focus trap, Esc). Dialog for short confirmations/ratings; Drawer (right, `width`) for the Propose-clause form. |
| `Document`, `DocSection`, `DocPara`, `DocQuote`, `DocSignature` | `kicker`, `symbol`, `seal`, `title`, `titleAs`, `meta`, `size: full\|compact` | **Every text that is a document in the world**: role brief, report (draft resolution), decline letters, vote statements, proposals, annexes. Serif, hanging paragraph numbers ("2.1"), `lead` for italic operative words ("Decides", "Requests"). |
| `PhaseBar` | `phase`, `track`, `detail` | Rendered by the shell; screens don't use it. |
| `RoundTable` | `seats`, `status: Record<id, player\|present\|absent\|excluded\|walked_out\|unknown>`, `highlight`, `trust`, `size`, `onSelectSeat`, `isSelectable`, `centerLabel`, `centerSub`, `statusLabels`, `label` | The central image. Same component on Seat, Convene, Attendance, Negotiate, Outcome. |
| `RoundTableLegend` | `items`, `labels` | Key under the table; list only states that can occur on that screen. |

RoundTable semantics (keep them): `present` = chair in the delegation hue; `player` = ink chair + "YOU";
`absent` = dashed empty chair, place card still on the table; `excluded` = no chair, dotted ring, bare
letters (never invited); `walked_out` = chair pushed back and turned, place card struck through;
`unknown` = neutral chair (invited / not yet known). `highlight` draws a slowly turning ring: use it
for the current speaker on Negotiate. `trust` shows a small signed marker beside present chairs.
Seats are focusable buttons only when `onSelectSeat` is given; every seat has an aria-label.

## Layout patterns

- Page widths: `l-page` (1200), `l-page--narrow` (760: quiz, a single document), `l-page--wide` (1360: Negotiate).
- Two columns: `l-split` = content + 300–400px sticky aside (`l-sticky`). Used by Seat and Convene.
- **Negotiate (three columns)**: `l-page--wide`, grid `minmax(260px, 300px) minmax(0, 1fr) minmax(300px, 360px)`:
  left = RoundTable (size ~300, `trust`, `highlight` = speaker) + legend; centre = transcript and composer
  (round/cycle line on top, addressee Select, TextArea, primary Send, Propose clause opens a Drawer,
  side payment as secondary); right = clauses on the table, then AI suggestions. Messages from delegations
  get a `DelegationBadge` and sans text; chair/system messages are small italic `--ink-3` lines; tag hits
  under player messages are `Chip`s ("verify without weights → softened EVAL"); `fallback` messages get
  a `warn` Chip "offline fallback". Busy: disable the composer, show `TypingDots` for `busy.who`.
- Report/Vote/Outcome: centre the `Document` (max ~860px); actions in `l-actions l-actions--end` below.
- Step actions go in `l-actions`: one primary on the right, alternatives as secondary, back/skip as quiet.

## Do / don't

- Do use hairlines, whitespace and alignment. Don't wrap every section in a bordered card.
- Do keep labels self-explanatory. Don't put helper text under every control.
- Do use the serif only for documents and titles. Don't set interface controls in serif.
- Don't use emoji, gradients, glass, saturated blue, chips inside buttons, flags, external fonts/images/scripts.
- Don't use the accent outside decision moments. Don't introduce new colours; add a token if you must.
- Do honour `prefers-reduced-motion` (tokens already zero durations; check custom JS timers as Attendance does).
- Do give every icon-only control an aria-label and keep focus rings visible (`:focus-visible` in base.css).
- Screens get data only from the hooks in `src/game/context.tsx`; never import `src/engine` code (types are fine) or `src/ui/dev`.

## Fixtures and adding a screen

The normal entry point uses the real game providers. In the Vite dev server, open `/?fixtures#/dev`
to jump to a fixture for any phase, including failed attendance and Track 2. The fixture tools also
toggle the error banner, busy state and kiosk mode. Add a fixture in `build()` and `FIXTURE_LIST`.

To add a screen: create `screens/Name.tsx` + `Name.css`, start with `<div className="l-page …">` and a
`ScreenHead` or a `Document` with `titleAs="h1"`. Register it in `App.tsx` using `PlayScreen`
for phases or the route switch for companion pages.

## Delegation editor (`#/delegations`)

Team pages for adding and editing delegations without touching YAML. Data comes from `useConfig()`; edits go through
`useConfigEdit()` (`ConfigEditApi`). Under `?fixtures` a fake in `dev/FixtureProviders.tsx` keeps saved drafts in React state.

- `screens/Delegations.tsx`: cast list, "How edits reach the team", pack export/import, discard all, and the add flow (`#/delegations/new`).
- `screens/DelegationEditor.tsx`: one local draft per page, a "what this delegation still needs" checklist, twelve sections, a fixed save bar.
  Nothing reaches the game until Save: `validate(draft)`, then `save(draft)`. Issue paths are matched to fields by exact path or prefix.
- `components/editor/`: `EditorContext` (fields bound to a draft path such as `red_lines[0].label`), `ConditionBuilders` (clause and
  convening conditions as selects plus a sentence), `ListEditor` (add, remove with undo, reorder; `SourcePicker`), `Sections`.
- `lib/editorModel.ts`: pure helpers (checklist, condition sentences, vote explanation, id generation). Add a new field by
  rendering `TextField`/`AreaField`/`NumField` with its path; no state wiring needed.
