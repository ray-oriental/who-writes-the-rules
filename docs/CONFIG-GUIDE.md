# Editing the summit configuration

The YAML files under `config/` supply the role cards, negotiation choices, and deterministic rules. Each delegation begins with a placeholder notice. Replace assumptions with evidence and keep an explicit research task for anything unresolved.

## Find the right file

- `scenario.yaml` holds the title, introduction, language, seat order, and repository edit-link settings.
- `rules.yaml` holds rounds, voting, trust, Track 2, exchange limits, and audience-rating questions.
- `forums.yaml` lists venues. `convene.yaml` defines agenda scopes and meeting formats. A scope allows categories of clauses.
- `agenda_catalog.yaml` holds clause sentences, parameters, allowed values, and defaults. Every `{placeholder}` must name a parameter in that template.
- `argument_tags.yaml` holds the five argument types and lower-case phrases recognised by the offline tagger. `side_payments.yaml` lists available exchanges.
- `quiz.yaml` holds the learning questions and enable switch.
- `delegations/*.yaml` holds each role's facts, relations, voices, attendance, red lines, priorities, claims, and research tasks.
- `general.yaml` holds claims and research for shared rules, venues, and clauses. Claims are embedded YAML records. The app can export the combined claims as CSV.
- `prompts/` holds model instructions maintained by the LLM worker. Coordinate prompt edits with that owner.

## Edit a delegation on GitHub

Open the repository, choose the intended branch, and open the relevant file under `config/delegations/`. Use the pencil button. Set `owner` to your handle or initials if you take responsibility. Edit a small section, preview the diff, and use GitHub's change proposal or pull-request flow for the lead to review. Preserve IDs that other files reference. Keep personal names, emails, credentials, and local computer paths out of repository content.

Each file's `summary` appears on the seat card. `mandate`, `facts`, and `relations` supply the role card. `say` sentences explain engine decisions and feed offline dialogue. Write them in the delegation's voice. Keep UI and configuration prose in English.

Players choose the guests at every convening. A forum's `members_fixed` lists eligible seats, and the player's own seat is always present. An omitted eligible delegation incurs `trust.excluded`. A fixed-forum nonmember incurs `trust.exclusive_forum_nonmember`. An invited delegation can still decline if its willingness falls below its threshold. An empty guest list leaves only the player and can fail quorum.

## Write conditions the engine understands

Every key inside a `when` must hold together. A red-line condition describes a violation. A must-have condition describes satisfaction. An attendance condition describes a convening choice.

This red line fires when a weights-access clause is present.

```yaml
- id: cn_no_weights_access
  label: Protect model weights
  when: {clause: model_access, param: level, equals: weights}
  voice: regulator
  say: We cannot accept compulsory transfer of model weights to outside testers.
  source_ids: [C-CN-06]
```

This priority earns weight when national execution is specified. When it is absent or unsatisfied, its weight is subtracted. Accepted arguments add softening up to the configured cap.

```yaml
- id: national_execution
  label: National test execution
  when: {clause: verifier, param: who, equals: national_institute}
  weight: 2
  softenable_by: [mutual_recognition, sovereignty_respect]
  soften_amount: 1
  max_soften: 2
  say: Our national institutions should execute the tests.
  source_ids: [C-CN-07]
```

This attendance rule applies when an official agenda permits export controls, even before anyone tables that clause.

```yaml
- id: cn_export_agenda
  when: {agenda_includes: export_controls, format: track1}
  modifier: -4
  action: refuse
  say: We will not join an official safety agenda containing export controls.
  source_ids: [C-CN-05]
```

Clause conditions also support `in`, `not_in`, `gte`, `lte`, and `includes` for multi-value membership. Use `clause_present` or `clause_absent` to test presence directly. Numeric bounds can be combined. A parameter comparison requires a matching clause and parameter.

Convening conditions support `forum`, `forum_exclusive`, `not_invited`, `format`, `annex_exists`, `other_invited`, and `other_not_invited`. `agenda_includes` accepts a category or a template ID resolved to its category. Thus a capacity-building condition also fires for other scopes that allow its governance category. The contracts support no nested OR expressions or arbitrary expressions.

## Connect rules to evidence

For the full research workflow, from claiming a task to merging the pull request, see the bilingual [research guide](RESEARCH-GUIDE.md).

Add a claim inside the same delegation's `claims` list. Give it a globally unique ID such as `C-CN-10`, a narrowly worded `claim`, and `used_in` pointers naming the affected rule IDs. Add its ID to each affected item's `source_ids`. General claims use `C-GEN-NN`.

Only add `source` and `url` after opening a document and checking the exact claim. Record institution, document title, date, and relevant section. Use `confidence: high` or `medium` as warranted. For an assumption, leave `source: ""`, use `confidence: low`, explain the assumption in `notes`, and create a research task linked through `claim_ids`. A historical roster requires its date. A policy document alone cannot establish a numerical trust penalty or an actor's negotiating veto.

Research IDs follow `R-CN-NN` or `R-GEN-NN`. Ask a concrete question, name dependent rule IDs in `why`, and give document or institution leads. Start with `todo`, use `in_progress` while investigating, and use `found` when the opened source settles that question. Use `verified` after another teammate independently checks the source and claim. Record the review in `notes`. Narrow the question or keep it open when only part is settled.

## Check before requesting review

Run `npm run check-config` for the repository's configuration validation. The in-app Config Errors page identifies the file, field path, and problem when configuration cannot load. Errors require repair. Review warnings too, particularly missing references. These checks validate structure and references. Teammates must also assess evidence and balance.

Use spaces with consistent indentation, usually two spaces per level. Tabs cause trouble. Lists need a dash on each item. Quote any sentence containing a colon followed by a space, for example `say: "Our position: national execution."`. Quote numeric-looking enum values such as `"1e25"`. Keep booleans as `true` or `false`, preserve empty lists as `[]`, and check matching quotes and brackets. Use `>-` for a long folded paragraph. Re-run validation after each small edit, then ask the lead to review the changed rules and linked evidence.
