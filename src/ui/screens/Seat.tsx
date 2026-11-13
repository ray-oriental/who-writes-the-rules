import { useState } from 'react';
import type { DelegationConfig, Id } from '../../engine/types';
import { useConfig, useGame } from '../../game/context';
import { Button } from '../components/Button';
import { DelegationBadge } from '../components/DelegationBadge';
import { RadioCards } from '../components/Forms';
import { RoundTable, RoundTableLegend, type SeatStatus } from '../components/RoundTable';
import { useDelegations } from '../lib/delegations';
import './Seat.css';

const DIFFICULTY: Record<DelegationConfig['difficulty'], string> = {
  easier: 'Easier',
  medium: 'Medium',
  harder: 'Harder',
};

const TYPE: Record<DelegationConfig['type'], string> = {
  state: 'State',
  regional: 'Regional bloc',
  firm: 'Company',
  expert_body: 'Expert body',
};

function Difficulty({ level }: { level: DelegationConfig['difficulty'] }) {
  const n = level === 'easier' ? 1 : level === 'medium' ? 2 : 3;
  return (
    <span className="seat-difficulty">
      <span className="seat-difficulty__pips" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <span key={i} className={i <= n ? 'is-on' : undefined} />
        ))}
      </span>
      {DIFFICULTY[level]}
    </span>
  );
}

export function SeatScreen() {
  const { config } = useConfig();
  const { actions } = useGame();
  const { all, get } = useDelegations();
  const [selected, setSelected] = useState<Id | null>(null);
  const [hover, setHover] = useState<Id | null>(null);
  const s = config.scenario;
  const playable = (id: Id) => !!get(id).config?.playable;
  const exampleForum = config.forums.find(forum => forum.id === 'un_multilateral' && !forum.members_fixed);
  const exampleAgenda = config.convene.agenda_scopes.find(scope => scope.id === 'tests_verification');

  const status: Record<Id, SeatStatus> = {};
  for (const id of s.seats) status[id] = id === selected ? 'player' : 'present';

  return (
    <div className="l-page seat">
      <div className="l-split">
        <div className="l-stack">
          <header className="seat__intro">
            <p className="t-eyebrow">A simulated summit on testing frontier AI</p>
            <h1 className="t-display">{s.title}</h1>
            <p className="seat__tagline">{s.tagline}</p>

          </header>

          <section className="seat__guide" aria-labelledby="seat-guide">
            <h2 id="seat-guide" className="t-heading">How to play</h2>
            <ol className="seat__steps">
              <li><strong>1. Invite</strong><p>Choose a delegation, a venue and whom to invite.</p></li>
              <li><strong>2. Negotiate</strong><p>Propose test clauses and discuss them with the delegates who attend.</p></li>
              <li><strong>3. Vote</strong><p>Put the draft to a vote, then see who backed it and why.</p></li>
            </ol>
            {playable('china') && exampleForum && exampleAgenda && (
              <details className="seat__example">
                <summary>Try a first summit</summary>
                <p>Play as China. Choose {exampleForum.name} and {exampleAgenda.label}, and invite everyone.
                  At the table, try a shared test with national verification.</p>
                <Button size="sm" onClick={() => actions.chooseSeat('china')}>Start as China</Button>
              </details>
            )}
          </section>

          <section className="l-stack" aria-labelledby="seat-choose">
            <div className="seat__choose-head">
              <h2 id="seat-choose" className="t-heading">
                Choose your delegation
              </h2>
              <p className="t-meta">You play its {s.player_role.toLowerCase()}. AI plays the others.</p>
            </div>
            <RadioCards
              legend="Delegation"
              hideLegend
              value={selected}
              onChange={setSelected}
              onPreview={setHover}
              columns={2}
              options={all.map((d) => ({
                value: d.id,
                leading: <DelegationBadge id={d.id} />,
                title: d.name,
                description: d.config?.summary,
                disabled: !d.config?.playable,
                disabledReason: 'Played by AI',
                meta: d.config && (
                  <>
                    <Difficulty level={d.config.difficulty} />
                    <span className="seat__dot" aria-hidden="true">
                      ·
                    </span>
                    {TYPE[d.config.type]}
                  </>
                ),
              }))}
            />
            <div className="l-actions">
              <Button
                variant="primary"
                size="lg"
                icon="arrow-right"
                disabled={!selected}
                onClick={() => selected && actions.chooseSeat(selected)}
              >
                {selected ? `Take the ${get(selected).name} seat` : 'Choose a seat'}
              </Button>
            </div>
          </section>
        </div>

        <aside className="l-sticky seat__table" aria-label="Seating plan">
          <RoundTable
            seats={s.seats}
            status={status}
            highlight={hover}
            size={420}
            onSelectSeat={(id) => playable(id) && setSelected(id)}
            isSelectable={playable}
            centerLabel={config.forums.length ? 'The summit' : undefined}
            centerSub={`${s.seats.length} delegations`}
            statusLabels={{ present: 'AI delegation' }}
            label="Seating plan, clockwise from the top"
          />
          <RoundTableLegend
            items={selected ? ['player', 'present'] : ['present']}
            labels={{ present: 'AI delegation' }}
          />
          <p className="seat__text">{s.intro}</p>
        </aside>
      </div>
    </div>
  );
}
