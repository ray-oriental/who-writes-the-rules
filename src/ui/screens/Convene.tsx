import { useState } from 'react';
import type { Id, TrackFormat } from '../../engine/types';
import { useConfig, useGame } from '../../game/context';
import { Button } from '../components/Button';
import { DelegationBadge } from '../components/DelegationBadge';
import { CheckboxList, RadioCards } from '../components/Forms';
import { Banner, ScreenHead, Section } from '../components/Misc';
import { RoundTable, RoundTableLegend, type SeatStatus } from '../components/RoundTable';
import { listNames, useDelegations } from '../lib/delegations';
import './Convene.css';

function humanise(category: string): string {
  return category.replace(/_/g, ' ');
}

export function ConveneScreen() {
  const { config } = useConfig();
  const { view, actions } = useGame();
  const { state, derived, busy } = view;
  const { get } = useDelegations();
  const seats = config.scenario.seats;
  const others = seats.filter((id) => id !== state.seat);
  const rules = config.rules;

  const prev = state.choices;
  const firstForum = derived.selectable_forums[0] ?? config.forums[0]?.id ?? '';
  const [forumId, setForumId] = useState<Id>(
    prev && derived.selectable_forums.includes(prev.forum) ? prev.forum : firstForum,
  );
  const [scopeId, setScopeId] = useState<Id>(prev?.agenda_scope ?? config.convene.agenda_scopes[0]?.id ?? '');
  const [format, setFormat] = useState<TrackFormat>(
    prev?.format === 'track2' && rules.track2.enabled && state.track2.used < rules.track2.uses_per_game ? 'track2' : 'track1',
  );
  const [forumInvitations, setForumInvitations] = useState<Partial<Record<Id, Id[]>>>(
    () => prev ? { [prev.forum]: prev.invited } : {},
  );

  const forumById = (id: Id) => config.forums.find((f) => f.id === id);
  const forum = forumById(forumId);
  const eligible = forum ? others.filter(id => !forum.members_fixed || forum.members_fixed.includes(id)) : [];
  const picked = forumInvitations[forumId] ?? eligible;
  const invited = eligible.filter(id => picked.includes(id));

  const status: Record<Id, SeatStatus> = {};
  for (const id of seats) {
    status[id] = id === state.seat ? 'player' : invited.includes(id) ? 'unknown' : 'excluded';
  }

  const possibleAttendees = invited.length + 1;
  const missingForQuorum = rules.quorum - possibleAttendees;
  const left = others.filter((id) => !invited.includes(id));
  const attempt = state.convene_attempts + 1;
  const attemptsTotal = rules.reconvene_attempts + 1;
  const annex = state.track2.annex;
  const canConvene = !!forum && derived.selectable_forums.includes(forumId) && !busy;

  const forumOptions = config.forums.map((f) => {
    const selectable = derived.selectable_forums.includes(f.id);
    const fixedNames = f.members_fixed?.map((id) => get(id).short);
    const access = fixedNames ? `Members: ${fixedNames.join(', ')}` : f.exclusive ? 'Invitation-based forum' : 'Open forum';
    return {
      value: f.id,
      title: f.name,
      description: f.description,
      meta: `${access} · Binding: ${f.binding_level}`,
      disabled: !selectable,
      disabledReason: fixedNames ? `Open only to ${listNames(fixedNames)}` : 'Not open to your delegation',
    };
  });

  const scopeOptions = config.convene.agenda_scopes.map((s) => ({
    value: s.id,
    title: s.label,
    description: s.description,
    meta: s.categories.map(humanise).join(' · '),
  }));

  const formatOptions = config.convene.formats.map((f) => {
    const off = f.id === 'track2' && (!rules.track2.enabled || state.track2.used >= rules.track2.uses_per_game);
    return {
      value: f.id,
      title: f.label,
      description: f.description,
      disabled: off,
      disabledReason: rules.track2.enabled ? 'Expert channel already used' : 'Not enabled in this scenario',
    };
  });

  return (
    <div className="l-page convene">
      <ScreenHead
        eyebrow={`Attempt ${attempt} of ${attemptsTotal}`}
        title="Convene the summit"
        lead="Choose a forum, set your guest list, and pick the agenda and meeting format."
      />

      <div className="l-split">
        <div className="l-stack l-stack--lg">
          {annex && annex.length > 0 && (
            <Banner tone="info" title="A technical annex is on file">
              The expert channel agreed {annex.length} clause{annex.length === 1 ? '' : 's'}. Delegations that require
              prior technical consensus will take it into account.
            </Banner>
          )}

          <Section number="1" title="Choose a forum">
            <RadioCards
              legend="Forum"
              hideLegend
              value={forumId}
              onChange={setForumId}
              columns={2}
              options={forumOptions}
              disabled={!!busy}
            />
          </Section>

          <Section number="2" title="Invite delegations" aside={`${invited.length} of ${eligible.length} invited`}>
            <div className="l-stack l-stack--sm">
              <p className="t-meta">
                Your seat is reserved. Invited delegations may decline. At least {rules.quorum} delegations,
                including yours, must attend to open negotiations.
              </p>
              {missingForQuorum > 0 && (
                <p className="t-meta convene__quorum" role="status">
                  {eligible.length + 1 < rules.quorum
                    ? `This forum can seat at most ${eligible.length + 1}. Choose another forum to reach quorum.`
                    : `At most ${possibleAttendees} can attend with this guest list. Invite at least ${missingForQuorum} more to reach quorum.`}
                </p>
              )}
            </div>
            {eligible.length > 0 ? (
              <CheckboxList
                legend="Invite delegations"
                hideLegend
                value={invited}
                onChange={guests => setForumInvitations(current => ({ ...current, [forumId]: guests }))}
                disabled={!!busy}
                items={eligible.map((id) => ({
                  value: id,
                  leading: <span aria-hidden="true"><DelegationBadge id={id} size="sm" /></span>,
                  label: get(id).name,
                }))}
              />
            ) : <p className="t-meta">No other delegations are eligible for this forum.</p>}
          </Section>

          <Section number="3" title="Choose an agenda">
            <RadioCards
              legend="Agenda scope"
              hideLegend
              value={scopeId}
              onChange={setScopeId}
              columns={3}
              options={scopeOptions}
              disabled={!!busy}
            />
          </Section>

          <Section number="4" title="Choose a meeting format">
            <RadioCards
              legend="Format"
              hideLegend
              value={format}
              onChange={(v) => setFormat(v as TrackFormat)}
              columns={2}
              options={formatOptions}
              disabled={!!busy}
            />
          </Section>
        </div>

        <aside className="l-sticky convene__aside" aria-label="Invitation preview">
          <RoundTable
            seats={seats}
            status={status}
            size={380}
            centerLabel={`${possibleAttendees} of ${seats.length}`}
            centerSub="possible attendees"
            label="Invitation preview"
          />
          <RoundTableLegend items={['player', 'unknown', 'excluded']} />

          <dl className="convene__summary">
            <div>
              <dt>Forum</dt>
              <dd>{forum?.name ?? '—'}</dd>
            </div>
            <div>
              <dt>Agenda</dt>
              <dd>{config.convene.agenda_scopes.find((s) => s.id === scopeId)?.label ?? '—'}</dd>
            </div>
            <div>
              <dt>Format</dt>
              <dd>{config.convene.formats.find((f) => f.id === format)?.label ?? '—'}</dd>
            </div>
            <div>
              <dt>Not invited</dt>
              <dd>{left.length ? listNames(left.map((id) => get(id).short)) : 'None'}</dd>
            </div>
          </dl>

          {state.previous && (
            <p className="convene__previous t-meta">
              Last run: {forumById(state.previous.choices.forum)?.name}, {state.previous.attended.length} attended,{' '}
              {state.previous.outcome.replace(/_/g, ' ')}.
            </p>
          )}

          <Button
            variant="decision"
            size="lg"
            className="convene__go"
            disabled={!canConvene}
            onClick={() => actions.convene({ forum: forumId, agenda_scope: scopeId, format, invited })}
          >
            {busy?.kind === 'convening' ? 'Sending invitations…' : 'Convene'}
          </Button>
        </aside>
      </div>
    </div>
  );
}
