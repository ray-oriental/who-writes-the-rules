# Engine API

Import functions and shared types from `src/engine/index.ts`. State transformers return a new state when an action is valid and return the input state when it is invalid. Supply `now` as the last argument to phase-changing actions. Config and state inputs are never mutated. All timestamps are caller supplied.

- `parseConfig(files)` parses raw `config/...` YAML and Markdown strings into a validated config or actionable issues.
- `loadConfig()` parses Vite's eagerly bundled configuration with the same validator.
- `matchClauseCond(cond, clauses)` AND-matches the clause condition DSL.
- `matchConveneCond(cond, ctx)` AND-matches choices using `{ config, choices, delegation, seat, annex_exists }`.
- `validateParams(template, params)` fills defaults and clamps finite numbers, returning `undefined` for invalid values or unknown keys.
- `renderClause(template, params)` substitutes parameter values and optional value labels into clause text.
- `present(config, state)` returns current table members in scenario seat order, including the player.
- `allowedTemplates(config, state)` returns templates allowed by the agenda and active track.
- `createGame(config, { id, seed, now })` creates the initial seat-selection state.
- `chooseSeat(config, state, seat, now)` selects a playable delegation and opens its role card.
- `leaveRoleCard(config, state, now)` opens the convening screen (the opening quiz is no longer part of the flow).
- `submitQuiz(state, kind, answers, now)` records pre/post answers and advances the phase.
- `normalizeChoices(config, state, choices)` validates a forum/scope/format and normalizes invitations, returning `undefined` for invalid choices.
- `evaluateAttendance(config, state, choices)` computes attendance using the supplied normalized choices and current trust without penalties.
- `convene(config, state, choices, now)` computes attendance, exclusion penalties and parallel forums and consumes an expert use for Track 2.
- `setDeclineLetters(state, letters)` attaches a delegation-keyed record or `{ delegation, letter }[]` to decline/exclusion results.
- `quorumMet(config, state)` checks current attendance including the player and excluding walkouts.
- `enterRoom(config, state, now)` requires quorum, starts round 1, tables an available annex and posts the chair opening.
- `canReconvene(config, state)` reports whether attendance can return to convening.
- `reconvene(config, state, now)` returns attendance to Track 1 convening within the attempt limit or from expert attendance.
- `concede(config, state, now)` ends a convening/attendance attempt without a Track 1 agreement.
- `proposeClause(config, state, template, params)` creates or edits a tabled template, records its version and evaluates walkouts.
- `editClause(config, state, clauseId, params)` merges a partial parameter edit with the tabled clause's parameters.
- `withdrawClause(config, state, clauseId)` archives its version history in a system message, removes it and reevaluates walkouts.
- `acceptSuggestion(config, state, suggestionId)` tables a validated suggestion and removes it from the open suggestions.
- `dismissSuggestion(state, suggestionId)` removes an open suggestion during negotiations.
- `playerSpeak(config, state, { text, addressee?, tags, now })` appends a tagged player turn, applies capped softening and returns `{ state, responders }`.
- `pickResponders(config, state, addressee?, count?)` selects present AI delegations by address, conflict, recency and seat order.
- `pickVoice(config, state, delegation)` selects a red-line, unmet-preference or first configured voice id.
- `clauseBriefs(config, state, delegation)` returns engine-computed LLM clause positions and their reason sentences.
- `recordSpeech(config, state, { delegation, text, voice?, amendment?, fallback? })` records a present AI delegate's reply and optionally retains its safe amendment.
- `endRound(config, state)` advances a playable round and appends the next deterministic chair line.
- `canSpeak(config, state)` checks the negotiation phase and active track's round limit.
- `canRequestReport(config, state)` checks completed rounds against the early-report threshold.
- `offerSidePayment(config, state, delegation, payment)` records an offer within the active track/cycle allowance and posts its message.
- `startReport(config, state, now)` enters the report phase when enough rounds are completed.
- `reportPositions(config, state)` returns present delegates' supported and opposed clause texts for the rapporteur.
- `setReport(state, report)` accepts rapporteur prose, fixes clauses to the engine snapshot and permits one objection-backed revision.
- `objectToReport(state, text)` attaches the first objection to the current report for the controller's revision call.
- `computeVote(config, state)` returns deterministic `VoteDetail[]` with empty statements except forced thin-text and player-capital explanations.
- `finalizeVote(config, state, statements, now)` requires a current report, clamps eligible swing adjustments and stores a vote result in phase `vote`.
- `canStartTrack2(config, state)` checks expert-channel availability from attendance or a failed Track 1 vote.
- `startTrack2(config, state, now)` reruns attendance with the same invitations and an empty expert table, stashing Track 1 after a failed vote.
- `continueAfterVote(config, state, now)` advances cycles, saves an expert annex, restores Track 1 or classifies the outcome.
- `classifyOutcome(config, state, now, conceded?)` creates the outcome using the latest Track 1 vote and current participation.
- `counterfactuals(config, state)` recomputes absent major powers' attendance under single-dimension changes, at most two each.
- `openDebrief(state, now)` opens the debrief from the outcome screen.
- `finishDebrief(config, state, now)` opens the postquiz or finishes the game.
- `replay(config, state, { id, now })` resets trust and gameplay, retaining the seat, seed and prior-run comparison.
- `derive(config, state)` returns the UI's `DerivedView`, with crossed red lines projected to plain opposition.

The controller should sequence `playerSpeak`, its selected `recordSpeech` calls, then `endRound`. For reports, call `startReport`, fetch rapporteur prose, then `setReport`. For an objection, call `objectToReport` before the single revised `setReport`. Use `computeVote` as vote-statement input, then call `finalizeVote` with `{ delegation, statement, adjust, fallback? }[]`.

Softening budgets apply across the game. Repeated tags are blocked per delegation, track and cycle. Side-payment ids are counted once per recipient across the game, while offer limits reset per track and cycle. Withdrawn-clause histories remain readable in the transcript because the frozen contract has no structured archive. Invalid actions are harmless no-ops.
