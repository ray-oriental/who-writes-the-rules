import { useConfig, useGame } from '../../game/context';
import { Button } from '../components/Button';
import { DelegationBadge } from '../components/DelegationBadge';
import { DocPara, DocQuote, DocSection, Document } from '../components/Document';
import { useDelegations } from '../lib/delegations';
import './RoleCard.css';

export function RoleCardScreen() {
  const { config } = useConfig();
  const { view, actions } = useGame();
  const { get } = useDelegations();
  const me = get(view.state.seat);
  const d = me.config;
  if (!d) return null;
  const others = config.scenario.seats.filter((id) => id !== d.id);
  const s = config.scenario;
  let section = 0;
  const next = () => ++section;

  return (
    <div className="l-page rolecard">
      <Document
        titleAs="h1"
        kicker="Delegation brief · Restricted"
        symbol={`WWTR/BRIEF/${d.short}`}
        seal={<DelegationBadge id={d.id} size="lg" tone="solid" />}
        title={`Instructions to the ${d.name} delegation`}
        meta={[
          ['To', `${s.player_role}, ${d.name} delegation`],
          ['Re', 'Summit on testing frontier AI models'],
        ]}
      >
        <DocSection n={`${next()}.`} title="Your goal">
          <DocPara n={`${section}.1`}>{d.mandate}</DocPara>
          {d.voices.length > 1 && (
            <DocPara n={`${section}.2`} lead="Notes">
              that the delegation speaks with {d.voices.length} voices: {d.voices.map((v) => v.label).join('; ')}. Under
              its internal rules{' '}
              {d.internal_resolution === 'veto_by_any'
                ? 'any one of them can block a yes vote.'
                : 'the lead voice decides.'}
            </DocPara>
          )}
        </DocSection>

        {(d.red_lines.length > 0 || d.must_haves.length > 0) && (
          <DocSection n={`${next()}.`} title="What you must get, and what you cannot accept">
            <div className="rolecard__lists">
              {d.must_haves.length > 0 && (
                <div>
                  <h4 className="rolecard__sub">Must-haves</h4>
                  <ul className="rolecard__list">
                    {d.must_haves.map((m) => (
                      <li key={m.id}>
                        {m.label}
                        {m.weight >= 2 && <span className="rolecard__tag"> · high priority</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {d.red_lines.length > 0 && (
                <div>
                  <h4 className="rolecard__sub">Red lines</h4>
                  <ul className="rolecard__list">
                    {d.red_lines.map((r) => (
                      <li key={r.id}>{r.label}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <details className="rolecard__more">
              <summary>In the delegation's own words</summary>
              {[...d.must_haves, ...d.red_lines].map((x) => (
                <DocPara key={x.id}>
                  <strong className="rolecard__label">{x.label}.</strong>
                  <DocQuote>{x.say}</DocQuote>
                </DocPara>
              ))}
            </details>
          </DocSection>
        )}

        {d.facts.length > 0 && (
          <details className="rolecard__fold">
            <summary>Technical facts at your disposal ({d.facts.length})</summary>
            {d.facts.map((f, i) => (
              <DocPara
                key={i}
                n={`${i + 1}.`}
                aside={f.source_ids?.length ? `Source ${f.source_ids.join(', ')}` : undefined}
              >
                {f.text}
              </DocPara>
            ))}
          </details>
        )}

        <details className="rolecard__fold">
          <summary>Other delegations ({others.length})</summary>
          <div className="rolecard__relations">
            {others.map((id) => (
              <div className="rolecard__relation" key={id}>
                <DelegationBadge id={id} size="sm" />
                <span className="rolecard__relation-name">{get(id).name}</span>
                <span className="rolecard__relation-text">{d.relations[id] ?? 'No standing relationship.'}</span>
              </div>
            ))}
          </div>
        </details>
      </Document>

      <div className="l-actions l-actions--end rolecard__actions">
        <Button variant="quiet" onClick={actions.newGame}>
          Choose another seat
        </Button>
        <Button variant="primary" size="lg" icon="arrow-right" onClick={actions.leaveRoleCard}>
          Proceed to the summit
        </Button>
      </div>
    </div>
  );
}
