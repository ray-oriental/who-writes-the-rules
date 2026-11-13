import { useState } from 'react';
import type {
  AttendanceCondition,
  Claim,
  ConveneCond,
  MustHave,
  RedLine,
  ResearchNeed,
  Voice,
  WalkoutTrigger,
} from '../../../engine/types';
import { useConfig } from '../../../game/context';
import { Chip } from '../Misc';
import { CheckboxList, Field, Select } from '../Forms';
import { getIn, uniqueId, firstWords, nextCode, allCodes, explainVote } from '../../lib/editorModel';
import { describeAttendance, conveneParts, joinParts, describeClauseCond } from '../../lib/editorModel';
import {
  ClauseCondBuilder,
  ConveneCondBuilder,
  EffectControls,
  RuleSentence,
  useConveneContext,
} from './ConditionBuilders';
import { AreaField, NumField, SectionIntro, SelectField, TextField, useEditor } from './EditorContext';
import { LinesField, ListEditor, SourcePicker } from './ListEditor';

// ───────────────────────────── Shared pieces ─────────────────────────────

/** Keeps a rule's id in step with what it is called, until someone edits the id by hand. */
function useAutoId(listPath: string, base: string, idKey = 'id') {
  const { draft, set } = useEditor();
  return (value: string, previous: string) => {
    const list = (getIn(draft, listPath) as { id: string }[] | undefined) ?? [];
    const current = (getIn(draft, `${base}.${idKey}`) as string | undefined) ?? '';
    const others = list.map((x) => x.id).filter((id) => id !== current);
    const auto = previous.trim() ? uniqueId(previous, others) : '';
    if (current === '' || current === auto) set(`${base}.${idKey}`, value.trim() ? uniqueId(value, others) : '');
  };
}

function IdField({ base }: { base: string }) {
  return (
    <TextField path={`${base}.id`} label="Id" mono placeholder="made from the name above" hint="Used in files and by other items. Change it only if you must." />
  );
}

function VoicePick({ base }: { base: string }) {
  const { draft } = useEditor();
  if (draft.voices.length === 0) return null;
  return (
    <SelectField
      path={`${base}.voice`}
      label="Which voice holds this"
      placeholder="Any voice"
      options={draft.voices.map((v) => ({ value: v.id, label: v.label || v.id }))}
    />
  );
}

function Say({ base }: { base: string }) {
  return (
    <AreaField
      path={`${base}.say`}
      label="What it says"
      rows={2}
      placeholder="One sentence, in the delegation's own voice"
    />
  );
}

function Sources({ base }: { base: string }) {
  return <SourcePicker path={`${base}.source_ids`} />;
}

function Check({ path, label, hint }: { path: string; label: string; hint?: string }) {
  const { draft, set } = useEditor();
  return (
    <label className="ed-check">
      <input type="checkbox" checked={!!getIn(draft, path)} onChange={(e) => set(path, e.target.checked)} />
      <span>
        <span className="ed-check__label">{label}</span>
        {hint && <span className="ed-check__hint">{hint}</span>}
      </span>
    </label>
  );
}

const TYPE_OPTIONS = [
  { value: 'state', label: 'State' },
  { value: 'regional', label: 'Regional bloc' },
  { value: 'firm', label: 'Firm' },
  { value: 'expert_body', label: 'Expert body' },
];
const DIFFICULTY_OPTIONS = [
  { value: 'easier', label: 'Easier to persuade' },
  { value: 'medium', label: 'Medium' },
  { value: 'harder', label: 'Harder to persuade' },
];

// ───────────────────────────── 1. Identity ─────────────────────────────

export function IdentitySection() {
  return (
    <div className="l-stack">
      <SectionIntro>
        Who this delegation is. The summary appears on the seat card and the mandate on the role card, so write them for a player who knows nothing yet.
      </SectionIntro>
      <div className="ed-grid ed-grid--2">
        <TextField path="name" label="Name" placeholder="e.g. African Union" />
        <TextField path="short" label="Badge letters (2 to 4)" maxLength={4} mono hint="Shown in the round badge. Letters, never a flag." />
        <SelectField path="type" label="Type" options={TYPE_OPTIONS} />
        <SelectField path="difficulty" label="Difficulty" options={DIFFICULTY_OPTIONS} hint="How hard it is for the player to bring round." />
        <TextField path="owner" label="Owner" placeholder="your handle or initials" hint="The teammate who looks after this file." />
        <div className="ed-field-pad">
          <Check path="playable" label="The player may take this seat" hint="Off: the AI always plays it." />
        </div>
      </div>
      <TextField path="summary" label="One-line summary" placeholder="One sentence for the seat card" />
      <AreaField path="mandate" label="Mandate" rows={3} hint="What this delegation was sent to achieve, in two or three sentences. Shown on the role card." />
    </div>
  );
}

// ───────────────────────────── 2. Red lines ─────────────────────────────

export function RedLinesSection() {
  return (
    <div className="l-stack">
      <SectionIntro>
        A condition on the draft text that makes this delegation vote no, whatever else is in it. A good red line is one the real actor has said publicly it will not cross.
      </SectionIntro>
      <ListEditor<RedLine>
        path="red_lines"
        noun="red line"
        title={(r) => r.label}
        makeItem={() => ({ id: '', label: '', when: {}, say: '', source_ids: [] })}
        empty="No red lines yet. With none, this delegation can be talked into anything."
        render={(_, __, base) => <RedLineBody base={base} />}
      />
    </div>
  );
}

function RedLineBody({ base }: { base: string }) {
  const auto = useAutoId('red_lines', base);
  return (
    <>
      <TextField path={`${base}.label`} label="Name of the red line" placeholder="e.g. No foreign access to model weights" onValue={auto} />
      <ClauseCondBuilder path={`${base}.when`} lead="Crossed when" />
      <Say base={base} />
      <Sources base={base} />
      <div className="ed-grid ed-grid--2">
        <IdField base={base} />
        <VoicePick base={base} />
      </div>
    </>
  );
}

// ───────────────────────────── 3. Must-haves ─────────────────────────────

export function MustHavesSection() {
  return (
    <div className="l-stack">
      <SectionIntro>
        Things it wants in the text. Each has a weight from 1 to 3 (3 = it matters most). It votes yes when enough of them are met; the voting section shows how many.
      </SectionIntro>
      <ListEditor<MustHave>
        path="must_haves"
        noun="must-have"
        title={(m) => m.label}
        badge={(m) => <Chip>{`weight ${m.weight}`}</Chip>}
        makeItem={() => ({ id: '', label: '', when: {}, weight: 1, softenable_by: [], soften_amount: 1, max_soften: 2, say: '', source_ids: [] })}
        empty="No must-haves yet. Add at least two."
        render={(_, __, base) => <MustHaveBody base={base} />}
      />
    </div>
  );
}

function MustHaveBody({ base }: { base: string }) {
  const { config } = useConfig();
  const { draft, set } = useEditor();
  const auto = useAutoId('must_haves', base);
  const soft = (getIn(draft, `${base}.softenable_by`) as string[] | undefined) ?? [];
  return (
    <>
      <TextField path={`${base}.label`} label="Name of the need" placeholder="e.g. Tests run by a national institute" onValue={auto} />
      <ClauseCondBuilder path={`${base}.when`} lead="Met when" />
      <div className="ed-grid ed-grid--3">
        <NumField path={`${base}.weight`} label="Weight (1 to 3)" min={1} max={3} fallback={1} />
      </div>
      <CheckboxList
        legend="Arguments that can soften it when it is not met"
        items={config.tags.map((t) => ({
          value: t.id,
          label: (
            <span>
              <strong>{t.label}</strong> <span className="ed-muted">{t.description}</span>
            </span>
          ),
        }))}
        value={soft}
        onChange={(v) => set(`${base}.softenable_by`, v)}
      />
      {soft.length > 0 && (
        <div className="ed-grid ed-grid--3">
          <NumField path={`${base}.soften_amount`} label="Each argument counts" min={0} max={3} step={0.5} fallback={1} hint="Points given back per accepted argument." />
          <NumField path={`${base}.max_soften`} label="At most" min={0} max={6} step={0.5} fallback={2} hint="The cap, whatever the player says." />
        </div>
      )}
      <Say base={base} />
      <Sources base={base} />
      <div className="ed-grid ed-grid--2">
        <IdField base={base} />
        <VoicePick base={base} />
      </div>
    </>
  );
}

// ───────────────────────────── 4. Attendance ─────────────────────────────

export function AttendanceSection() {
  const { config } = useConfig();
  return (
    <div className="l-stack">
      <SectionIntro>
        Whether it accepts an invitation. Its willingness for the chosen forum, plus or minus the rules below, must reach the threshold. Higher numbers mean keener.
      </SectionIntro>
      <div className="ed-grid ed-grid--3">
        <NumField path="attendance.attend_threshold" label="Comes if willingness reaches" min={-10} max={20} />
        <NumField path="attendance.track2_willingness" label="Willingness for the expert channel" min={-10} max={10} />
        <NumField path="attendance.parallel_forum_propensity" label="Tendency to start a rival forum (0 to 1)" min={0} max={1} step={0.05} />
      </div>
      <h3 className="ed-subhead">Willingness for each forum</h3>
      <div className="ed-grid ed-grid--3">
        {config.forums.map((f) => (
          <NumField key={f.id} path={`attendance.base_willingness.${f.id}`} label={f.name} min={-10} max={10} />
        ))}
      </div>
      <h3 className="ed-subhead">Rules that add or subtract</h3>
      <p className="ed-muted">
        Each rule watches the convening choices. Leave a part as “Not part of the rule” to ignore it; all parts you do fill in must hold together.
      </p>
      <ListEditor<AttendanceCondition>
        path="attendance.conditions"
        noun="attendance rule"
        title={(c) => c.id}
        makeItem={() => ({ id: '', when: {}, modifier: -1, say: '', source_ids: [] })}
        empty="No attendance rules yet. Without them only the forum and the threshold matter."
        render={(_, __, base) => <AttendanceBody base={base} />}
      />
    </div>
  );
}

function AttendanceBody({ base }: { base: string }) {
  const { draft, set, update } = useEditor();
  const ctx = useConveneContext(draft.id);
  const when = (getIn(draft, `${base}.when`) as ConveneCond | undefined) ?? {};
  const modifier = getIn(draft, `${base}.modifier`) as number | undefined;
  const action = getIn(draft, `${base}.action`) as AttendanceCondition['action'];
  const auto = useAutoId('attendance.conditions', base);
  return (
    <>
      <ConveneCondBuilder value={when} excludeId={draft.id} onChange={(c) => set(`${base}.when`, c)} />
      <EffectControls
        modifier={modifier}
        action={action}
        onChange={(m, a) =>
          update((d) => {
            const target = getIn(d, base) as Record<string, unknown>;
            if (m === undefined) delete target.modifier;
            else target.modifier = m;
            if (a === undefined) delete target.action;
            else target.action = a;
          })
        }
      />
      <RuleSentence>{describeAttendance(when, modifier, action, ctx)}</RuleSentence>
      <AreaField path={`${base}.say`} label="What it says" rows={2} placeholder="One sentence of reasoning, in the delegation's own voice" onValue={auto} />
      <Sources base={base} />
      <IdField base={base} />
    </>
  );
}

// ───────────────────────────── 5. Walkouts ─────────────────────────────

const CLAUSE_KEYS = ['clause', 'param', 'equals', 'in', 'not_in', 'gte', 'lte', 'includes', 'clause_present', 'clause_absent'];
type WalkMode = 'clause' | 'convene' | 'both';

export function WalkoutsSection() {
  return (
    <div className="l-stack">
      <SectionIntro>
        Moments that make it leave the room mid-negotiation: a clause it cannot stomach being tabled, or a convening choice it was never willing to accept. A walkout costs the table a voter.
      </SectionIntro>
      <ListEditor<WalkoutTrigger>
        path="walkout_triggers"
        noun="walkout"
        title={(w) => w.id}
        makeItem={() => ({ id: '', when: {}, say: '', source_ids: [] })}
        empty="No walkout triggers. It stays seated whatever happens."
        render={(_, __, base) => <WalkoutBody base={base} />}
      />
    </div>
  );
}

function WalkoutBody({ base }: { base: string }) {
  const { draft, set } = useEditor();
  const ctx = useConveneContext(draft.id);
  const { config } = useConfig();
  const when = (getIn(draft, `${base}.when`) as Record<string, unknown> | undefined) ?? {};
  const hasClause = Object.keys(when).some((k) => CLAUSE_KEYS.includes(k));
  const hasConvene = Object.keys(when).some((k) => !CLAUSE_KEYS.includes(k));
  const [chosen, setChosen] = useState<WalkMode>('clause');
  const mode: WalkMode = hasClause && hasConvene ? 'both' : hasClause ? 'clause' : hasConvene ? 'convene' : chosen;
  const conveneOnly = Object.fromEntries(Object.entries(when).filter(([k]) => !CLAUSE_KEYS.includes(k))) as ConveneCond;
  const clauseOnly = Object.fromEntries(Object.entries(when).filter(([k]) => CLAUSE_KEYS.includes(k)));
  const auto = useAutoId('walkout_triggers', base);

  const pickMode = (m: WalkMode) => {
    setChosen(m);
    if (m === 'clause') set(`${base}.when`, clauseOnly);
    if (m === 'convene') set(`${base}.when`, conveneOnly);
  };

  const parts = [
    ...(hasClause ? [describeClauseCond(clauseOnly, config.catalog)] : []),
    ...conveneParts(conveneOnly, ctx),
  ].filter(Boolean);

  return (
    <>
      <Field label="It walks out because">
        {(id) => (
          <Select
            id={id}
            value={mode}
            options={[
              { value: 'clause', label: 'a clause is on the table' },
              { value: 'convene', label: 'of a convening choice (agenda, forum, guests)' },
              { value: 'both', label: 'of both together' },
            ]}
            onChange={(v) => pickMode(v as WalkMode)}
          />
        )}
      </Field>
      {(mode === 'clause' || mode === 'both') && (
        <ClauseCondBuilder path={`${base}.when`} lead="It walks out when" mixed />
      )}
      {(mode === 'convene' || mode === 'both') && (
        <ConveneCondBuilder
          value={conveneOnly}
          excludeId={draft.id}
          onChange={(c) => set(`${base}.when`, { ...clauseOnly, ...c })}
        />
      )}
      <RuleSentence>{parts.length ? `It walks out when ${joinParts(parts)}.` : ''}</RuleSentence>
      <AreaField path={`${base}.say`} label="What it says" rows={2} placeholder="What it says as it stands up" onValue={auto} />
      <Sources base={base} />
      <IdField base={base} />
    </>
  );
}

// ───────────────────────────── 6. Voting ─────────────────────────────

export function VotingSection() {
  const { config } = useConfig();
  const { draft } = useEditor();
  const ex = explainVote(draft.must_haves, draft.vote_threshold);
  return (
    <div className="l-stack">
      <SectionIntro>
        How its needs turn into a vote. It adds up its score and votes yes if the score reaches the threshold and no red line is crossed.
      </SectionIntro>
      <div className="ed-grid ed-grid--3">
        <NumField path="vote_threshold" label="Votes yes at a score of" min={-10} max={20} step={0.5} />
        <NumField
          path="trust_initial"
          label="Starting trust"
          min={config.rules.trust.min}
          max={config.rules.trust.max}
          hint={`From ${config.rules.trust.min} (hostile) to ${config.rules.trust.max} (friendly).`}
        />
      </div>
      <div className="ed-explain" aria-live="polite">
        <p className="ed-explain__head">{ex.headline}</p>
        {ex.lines.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </div>
      <h3 className="ed-subhead">What each side payment is worth to it</h3>
      <div className="ed-grid ed-grid--3">
        {config.side_payments.map((s) => (
          <NumField key={s.id} path={`side_payment_values.${s.id}`} label={s.label} hint={s.description} min={-5} max={5} step={0.5} />
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────── 7. Facts ─────────────────────────────

export function FactsSection() {
  return (
    <div className="l-stack">
      <SectionIntro>
        Technical or factual statements the delegation, and the player, may use. State one fact per entry, as narrowly as the source allows, and cite it.
      </SectionIntro>
      <ListEditor<{ text: string; source_ids?: string[] }>
        path="facts"
        noun="fact"
        title={(f) => firstWords(f.text, 9)}
        makeItem={() => ({ text: '', source_ids: [] })}
        empty="No facts yet."
        render={(_, __, base) => (
          <>
            <AreaField path={`${base}.text`} label="The fact" rows={2} />
            <Sources base={base} />
          </>
        )}
      />
    </div>
  );
}

// ───────────────────────────── 8. Relations ─────────────────────────────

export function RelationsSection() {
  const { config } = useConfig();
  const { draft } = useEditor();
  const others = config.delegations.filter((d) => d.id !== draft.id);
  return (
    <div className="l-stack">
      <SectionIntro>
        One line on how this delegation sees each of the others, from its own point of view: partner, rival, or just wary. These lines go onto the role card.
      </SectionIntro>
      {others.length === 0 && <p className="ed-muted">There are no other delegations yet.</p>}
      <div className="l-stack">
        {others.map((o) => (
          <TextField key={o.id} path={`relations.${o.id}`} label={`How it sees ${o.name}`} />
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────── 9. Voices ─────────────────────────────

const RESOLUTION_TEXT: Record<string, string> = {
  veto_by_any: 'Any one voice can block: a red line held by any voice is enough to vote no.',
  lead_voice: 'Only the lead voice decides; rules held by other voices are ignored.',
  average: 'Each voice scores the needs it holds, and the delegation votes on the average.',
};

export function VoicesSection() {
  const { draft } = useEditor();
  return (
    <div className="l-stack">
      <SectionIntro>
        Optional. Use voices when one delegation is not of one mind, for example an engineer and a regulator. Then give each rule a voice and choose how they settle disagreements. Leave it empty for a single voice.
      </SectionIntro>
      <ListEditor<Voice>
        path="voices"
        noun="voice"
        title={(v) => v.label || v.id}
        makeItem={() => ({ id: '', label: '', priorities: [] })}
        empty="No voices: the delegation speaks with one voice."
        render={(_, __, base) => <VoiceBody base={base} />}
      />
      {draft.voices.length > 0 && (
        <div className="l-stack">
          <SelectField
            path="internal_resolution"
            label="How the voices settle a disagreement"
            options={[
              { value: 'veto_by_any', label: 'Any voice can veto' },
              { value: 'lead_voice', label: 'The lead voice decides' },
              { value: 'average', label: 'Average of the voices' },
            ]}
            hint={RESOLUTION_TEXT[draft.internal_resolution]}
          />
          {draft.internal_resolution === 'lead_voice' && (
            <SelectField
              path="lead_voice"
              label="Lead voice"
              placeholder="Choose the lead voice"
              options={draft.voices.map((v) => ({ value: v.id, label: v.label || v.id }))}
            />
          )}
        </div>
      )}
    </div>
  );
}

function VoiceBody({ base }: { base: string }) {
  const auto = useAutoId('voices', base);
  return (
    <>
      <TextField path={`${base}.label`} label="Who this voice is" placeholder="e.g. Standards engineer" onValue={auto} />
      <LinesField path={`${base}.priorities`} label="Its priorities (one per line)" rows={3} />
      <IdField base={base} />
    </>
  );
}

// ───────────────────────────── 10. Brief ─────────────────────────────

export function BriefSection() {
  return (
    <div className="l-stack">
      <SectionIntro>
        The instructions the AI gets when it plays this delegation. Say what the delegation wants, which facts it may use, and what it must never claim; name claims by their ids.
      </SectionIntro>
      <AreaField path="brief" label="Role brief" rows={9} hint="Position, usable facts and claim ids, things not to say." />
      <AreaField path="style" label="Speaking style" rows={3} hint="Tone and manner in a sentence or two, e.g. formal and sparing with concessions." />
    </div>
  );
}

// ───────────────────────────── 11. Claims ─────────────────────────────

const CONFIDENCE = [
  { value: 'high', label: 'High: a primary source says so' },
  { value: 'medium', label: 'Medium: a reliable secondary source or a fair reading' },
  { value: 'low', label: 'Low: an assumption the team wants to check' },
];

export function ClaimsSection() {
  const { config, draft } = useEditor();
  return (
    <div className="l-stack">
      <SectionIntro>
        Every rule is a claim about the real world. Record each claim once, say where it comes from, and say how sure you are. A claim without a source is marked, and the rules that lean on it count as unsourced.
      </SectionIntro>
      <ListEditor<Claim>
        path="claims"
        noun="claim"
        title={(c) => `${c.id}  ${firstWords(c.claim, 7)}`.trim()}
        badge={(c) => (c.source.trim() ? null : <Chip tone="warn">Needs a source</Chip>)}
        makeItem={() => ({
          id: nextCode('C', draft.short, allCodes(config, draft)),
          claim: '',
          used_in: [],
          source: '',
          confidence: 'medium' as const,
        })}
        render={(_, __, base) => <ClaimBody base={base} />}
      />
    </div>
  );
}

function ClaimBody({ base }: { base: string }) {
  return (
    <>
      <div className="ed-grid ed-grid--2">
        <TextField path={`${base}.id`} label="Id" mono hint="Format C-<letters>-NN, unique across the game." />
        <SelectField path={`${base}.confidence`} label="How sure are we" options={CONFIDENCE} />
      </div>
      <AreaField path={`${base}.claim`} label="The claim" rows={2} hint="One statement about the real world." />
      <TextField path={`${base}.source`} label="Source" placeholder="Author or body, title, date" hint="Leave empty only if you have not found one yet." />
      <TextField path={`${base}.url`} label="Link" mono placeholder="https://" />
      <AreaField path={`${base}.notes`} label="Notes" rows={2} />
    </>
  );
}

// ───────────────────────────── 12. Research ─────────────────────────────

const STATUS = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'found', label: 'Found, to verify' },
  { value: 'verified', label: 'Verified' },
];

export function ResearchSection() {
  const { config, draft } = useEditor();
  return (
    <div className="l-stack">
      <SectionIntro>
        Things the team still has to find out. Phrase each as a question, say which rule depends on it, and put your handle on the ones you take. Do not invent an answer; list it here instead.
      </SectionIntro>
      <ListEditor<ResearchNeed>
        path="research"
        noun="research question"
        title={(r) => `${r.id}  ${firstWords(r.question, 8)}`.trim()}
        badge={(r) => <Chip tone={r.status === 'verified' ? 'ok' : 'neutral'}>{STATUS.find((s) => s.value === r.status)?.label ?? r.status}</Chip>}
        makeItem={() => ({
          id: nextCode('R', draft.short, allCodes(config, draft)),
          question: '',
          why: '',
          status: 'todo' as const,
          owner: '',
          leads: [],
          claim_ids: [],
        })}
        render={(_, __, base) => <ResearchBody base={base} />}
      />
    </div>
  );
}

function ResearchBody({ base }: { base: string }) {
  const { draft, set } = useEditor();
  const claimIds = (getIn(draft, `${base}.claim_ids`) as string[] | undefined) ?? [];
  return (
    <>
      <div className="ed-grid ed-grid--3">
        <TextField path={`${base}.id`} label="Id" mono hint="Format R-<letters>-NN." />
        <SelectField path={`${base}.status`} label="Status" options={STATUS} />
        <TextField path={`${base}.owner`} label="Who takes it" placeholder="handle or initials" />
      </div>
      <AreaField path={`${base}.question`} label="The question" rows={2} />
      <AreaField path={`${base}.why`} label="Why it matters" rows={2} hint="Which rule or part of the brief depends on the answer." />
      <LinesField path={`${base}.leads`} label="Where to look (one per line)" rows={2} placeholder="A link, a document title, a person to ask" />
      {draft.claims.length > 0 && (
        <CheckboxList
          legend="Claims it would back up once answered"
          items={draft.claims.map((c) => ({
            value: c.id,
            label: (
              <span>
                <span className="ed-mono">{c.id}</span> {firstWords(c.claim, 8)}
              </span>
            ),
          }))}
          value={claimIds}
          onChange={(v) => set(`${base}.claim_ids`, v)}
        />
      )}
      <AreaField path={`${base}.notes`} label="Notes" rows={2} />
    </>
  );
}

