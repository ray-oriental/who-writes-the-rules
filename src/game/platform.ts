import { z } from 'zod';
import type { GameConfig, GameState } from '../engine/types';
import type { PublishedProposal, RankedProposal } from './api';


const outcome = z.enum(['full_agreement', 'club_standard', 'paper_standard', 'split_standards', 'expert_consensus', 'no_agreement']);
const proposalSchema = z.object({
  id: z.string(), game_id: z.string(), kind: z.enum(['proposal', 'annex']), title: z.string(),
  created_at: z.number(), seat: z.string(), outcome, forum: z.string(), forum_name: z.string(),
  clauses: z.array(z.string()), attended: z.array(z.string()), absent: z.array(z.string()),
  votes: z.array(z.object({ delegation: z.string(), vote: z.enum(['yes', 'no']) })),
  yes: z.number().int().nonnegative(), no: z.number().int().nonnegative(),
});
const ratingSchema = z.object({
  id: z.string(), proposal_id: z.string(), scores: z.array(z.number().int().min(1).max(5)),
  comment: z.string().max(500).optional(), at: z.number(),
});
export const gallerySchema = z.object({ schema: z.literal(1), proposals: z.array(proposalSchema), ratings: z.array(ratingSchema) });
export type Gallery = z.infer<typeof gallerySchema>;
export const emptyGallery: Gallery = { schema: 1, proposals: [], ratings: [] };

export function publication(config: GameConfig, previous: GameState, next: GameState): PublishedProposal | undefined {
  const annex = previous.phase === 'vote' && previous.track === 2 && !!previous.votes.at(-1)?.passed
    && !previous.track2.annex && !!next.track2.annex;
  const outcome = annex ? 'expert_consensus' : next.outcome?.type;
  if (!outcome || (!annex && (previous.outcome || !next.outcome?.passed))) return;
  const source = annex ? previous : next;
  const vote = annex ? previous.votes.at(-1) : next.outcome?.final_vote;
  if (!source.choices || !vote) return;
  const kind = annex ? 'annex' : 'proposal';
  const forum = config.forums.find(forum => forum.id === source.choices?.forum);
  const attended = vote.details.map(detail => detail.delegation);
  return {
    id: source.id + '-' + kind, game_id: source.id, kind, outcome,
    title: (forum?.name ?? 'Summit') + (annex ? ' technical annex' : ' proposal'),
    created_at: next.timeline.at(-1)?.at ?? next.started_at, seat: source.seat,
    forum: source.choices.forum, forum_name: forum?.name ?? source.choices.forum,
    clauses: source.clauses.map(clause => clause.text), attended,
    absent: config.scenario.seats.filter(id => !attended.includes(id)),
    votes: vote.details.filter(detail => detail.eligible).map(({ delegation, vote }) => ({ delegation, vote })),
    yes: vote.yes, no: vote.no,
  };
}

export function validScores(scores: number[], questions: number) {
  return scores.length === questions && scores.every(score => Number.isInteger(score) && score >= 1 && score <= 5);
}

export function rank(gallery: Gallery, questions: number, priorVotes: number): RankedProposal[] {
  const ratings = gallery.ratings.filter(rating => validScores(rating.scores, questions)
    && gallery.proposals.some(proposal => proposal.id === rating.proposal_id));
  const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const prior = ratings.length ? average(ratings.flatMap(rating => rating.scores)) : 3;
  return gallery.proposals.map(proposal => {
    const votes = ratings.filter(rating => rating.proposal_id === proposal.id);
    const means = votes.length ? Array.from({ length: questions }, (_, index) =>
      average(votes.map(rating => rating.scores[index]))) : [];
    const weight = priorVotes + votes.length;
    const score = weight ? (priorVotes * prior + (means.length ? average(means) * votes.length : 0)) / weight : prior;
    return { ...proposal, score, means, n_ratings: votes.length, rank: 0 };
  }).sort((a, b) => b.score - a.score || b.n_ratings - a.n_ratings || a.created_at - b.created_at || a.id.localeCompare(b.id))
    .map((proposal, index) => ({ ...proposal, rank: index + 1 }));
}

export function mergeGallery(current: Gallery, json: string, questions: number): { data: Gallery; added: number; error?: string } {
  try {
    const imported = gallerySchema.parse(JSON.parse(json));
    const proposals = new Map(current.proposals.map(item => [item.id, item]));
    const ratings = new Map(current.ratings.map(item => [item.id, item]));
    for (const item of imported.proposals) if (!proposals.has(item.id)) proposals.set(item.id, item);
    for (const item of imported.ratings) {
      if (!validScores(item.scores, questions) || !proposals.has(item.proposal_id)) {
        return { data: current, added: 0, error: 'A rating has the wrong number of scores or refers to a missing proposal.' };
      }
      if (!ratings.has(item.id)) ratings.set(item.id, item);
    }
    return {
      data: { schema: 1, proposals: [...proposals.values()], ratings: [...ratings.values()] },
      added: proposals.size - current.proposals.length + ratings.size - current.ratings.length,
    };
  } catch {
    return { data: current, added: 0, error: 'This file is not a valid version 1 gallery export.' };
  }
}
