import type { ClauseTemplate, DelegationConfig, GameConfig, ParamSpec } from '../../engine/types';
import { useConfig } from '../../game/context';
import { Button } from '../components/Button';
import { ScreenHead, Section } from '../components/Misc';
import './PrintCards.css';

const words = (value: string) => value.replaceAll('_', ' ');

function DelegationCard({ delegation }: { delegation: DelegationConfig }) {
  return <article className="print-cards__card print-cards__delegation">
    <h3><span className="print-cards__code" aria-hidden="true">{delegation.short}</span>{delegation.name}</h3>
    <p>{delegation.mandate}</p>
    <h4>Red lines</h4>
    {delegation.red_lines.length
      ? <ul>{delegation.red_lines.map(rule => <li key={rule.id}>{rule.say}</li>)}</ul>
      : <p>None in this scenario.</p>}
    <h4>Must-haves</h4>
    {delegation.must_haves.length
      ? <ul>{delegation.must_haves.map(rule => <li key={rule.id}>{rule.say}</li>)}</ul>
      : <p>None in this scenario.</p>}
  </article>;
}

function choicesFor(spec: ParamSpec) {
  if (spec.type === 'number') {
    const unit = spec.unit ? ' ' + spec.unit : '';
    return {
      allowed: `${spec.min}–${spec.max}${unit}${spec.step ? ` (step ${spec.step})` : ''}`,
      initial: String(spec.default) + unit,
    };
  }
  const label = (value: string) => spec.value_labels?.[value] ?? words(value);
  const defaults = spec.type === 'enum' ? [spec.default ?? spec.values[0]] : (spec.default ?? []);
  return {
    allowed: spec.values.map(label).join(' · '),
    initial: defaults.length ? defaults.map(label).join(', ') : 'None selected',
  };
}

function WriteIn({ label }: { label: string }) {
  return <div className="print-cards__write-in">
    <span>{label}</span><span className="print-cards__line" aria-hidden="true" />
  </div>;
}

function ClauseCard({ template }: { template: ClauseTemplate }) {
  const draft = template.text.replace(/\{([^{}]+)\}/g, (_, key: string) =>
    `[${template.params[key]?.label ?? words(key)}]`);
  return <article className="print-cards__card print-cards__clause">
    <p className="print-cards__category">{words(template.category)}</p>
    <h3>{template.label}</h3>
    <p className="print-cards__draft">{draft}</p>
    <dl>{Object.entries(template.params).map(([key, spec]) => {
      const { allowed, initial } = choicesFor(spec);
      return <div key={key}>
        <dt>{spec.label ?? words(key)}</dt>
        <dd>{allowed}</dd>
        <dd>Default · {initial}</dd>
        <dd><WriteIn label={spec.type === 'multi' ? 'Selected values' : 'Selected value'} /></dd>
      </div>;
    })}</dl>
  </article>;
}

function FacilitatorWorksheet({ config }: { config: GameConfig }) {
  const { rules, delegations } = config;
  const negativeCap = rules.pass_rule.type === 'iso_double'
    ? ` No more than ${rules.pass_rule.negative_cap * 100}% of eligible voters may vote against.`
    : '';
  const delegationCodes = new Map(delegations.map(delegation => [delegation.id, delegation.short]));
  const eligibility = rules.voting_mode === 'states_only'
    ? 'Only attending state and regional delegations vote.'
    : 'Every attending delegation may vote.';
  return <div className="print-cards__worksheet">
    <div className="print-cards__procedure">
      <h3>Simplified paper procedure</h3>
      <ol>
        <li>Assign a chair and hand out the delegation cards. Pick a forum and agenda. Choose which
          eligible delegations to invite. For a fixed-roster forum, use only the listed members.</li>
        <li>Ask each invitee whether the forum and agenda fit their mandate. Record who accepts and any walkouts.
          Allow up to {rules.rounds_per_cycle} rounds per cycle and {rules.max_cycles} cycles within
          the {rules.expo.time_limit_minutes}-minute Expo slot.</li>
        <li>Table only the clause categories allowed by your agenda. Agree on the values and read the
          draft aloud. Call a vote with at least {rules.quorum} delegates present and {rules.min_clauses_to_vote} clauses.</li>
        <li>{eligibility} A crossed red line means a no vote. The draft passes with at least two thirds of eligible
          voters in favour, rounded up to a whole vote.{negativeCap} Record one reason for a refusal, walkout or no vote.</li>
      </ol>
    </div>
    <div className="print-cards__meeting">
      <WriteIn label="Chair" />
      <WriteIn label="Forum" />
      <p className="print-cards__options">{config.forums.map(forum => forum.name + (forum.members_fixed
        ? ' (' + forum.members_fixed.map(id => delegationCodes.get(id) ?? id).join(', ') + ')'
        : '')).join(' · ')}</p>
      <WriteIn label="Agenda" />
      <dl className="print-cards__options">{config.convene.agenda_scopes.map(scope =>
        <div key={scope.id}><dt>{scope.label}</dt><dd>{scope.categories.map(words).join(', ')}</dd></div>
      )}</dl>
    </div>
    <table className="print-cards__vote">
      <caption>Invitations, attendance and vote</caption>
      <thead><tr>
        <th scope="col">Delegation</th><th scope="col">Invited</th><th scope="col">Attended</th>
        <th scope="col">Present at vote</th><th scope="col">Red line</th><th scope="col">Yes</th><th scope="col">No</th>
      </tr></thead>
      <tbody>{delegations.map(delegation => <tr key={delegation.id}>
        <th scope="row">{delegation.name}</th><td /><td /><td /><td /><td /><td />
      </tr>)}</tbody>
    </table>
    <div className="print-cards__totals">
      <WriteIn label="Eligible voters" /><WriteIn label="Yes needed" />
      <WriteIn label="Yes total" /><WriteIn label="No total" />
    </div>
    <WriteIn label="Outcome" />
    <WriteIn label="Clauses adopted" />
    <WriteIn label="Reason a delegation stayed out or opposed" />
  </div>;
}

export function PrintCardsScreen() {
  const { config } = useConfig();
  return <div className="l-page print-cards">
    <ScreenHead eyebrow={config.scenario.title} title="Print cards"
      lead="Give each participant a delegation card and keep the clause cards and worksheet at the table."
      aside={<Button variant="primary" onClick={() => window.print()}>Print or save as PDF</Button>} />
    <Section title="Delegation cards" id="print-delegations">
      <p className="print-cards__note">Simulation positions for this exercise.</p>
      <div className="print-cards__grid">
        {config.delegations.map(delegation => <DelegationCard key={delegation.id} delegation={delegation} />)}
      </div>
    </Section>
    <Section title="Clause cards" id="print-clauses">
      <div className="print-cards__grid">
        {config.catalog.map(template => <ClauseCard key={template.id} template={template} />)}
      </div>
    </Section>
    <Section title="Facilitator worksheet" id="print-facilitator">
      <FacilitatorWorksheet config={config} />
    </Section>
  </div>;
}
