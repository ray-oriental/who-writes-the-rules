import type { GameConfig, MustHave } from '../engine/types';
import type { DelegateInput, DelegateOutput, LlmRoles } from './types';

/**
 * Offline stand-in for the model. It is the default mode and the fallback when a call fails,
 * so what it writes is what most players read. Everything is derived from the role input and
 * the config (mostly the `say` sentences), and the same input always gives the same output.
 */

function hash(text: string): number {
  let value = 0;
  for (const char of text) value = (Math.imul(value, 31) + char.charCodeAt(0)) >>> 0;
  return value;
}

function pick<T>(options: readonly T[], key: string): T {
  return options[hash(key) % options.length];
}

/** Ends the text with exactly one full stop unless it already ends a sentence. */
function sentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** Clause text for quoting inside a sentence: no trailing stop, bounded length. */
function quote(text: string, max = 120): string {
  const trimmed = text.trim().replace(/[.]+$/, '');
  return trimmed.length > max ? `${trimmed.slice(0, max - 1).trimEnd()}…` : trimmed;
}

/** Lower-cases a label for use mid-sentence, leaving acronyms such as "API access" alone. */
function lowerFirst(label: string): string {
  const trimmed = label.trim();
  return /^[A-Z](?:[a-z]|\s)/.test(trimmed) ? trimmed[0].toLowerCase() + trimmed.slice(1) : trimmed;
}

function ordinal(n: number): string {
  return ['First', 'Second', 'Third', 'Fourth', 'Fifth'][n - 1] ?? `Cycle ${n}:`;
}

type Register = 'formal' | 'direct' | 'technical';

function registerOf(style: string): Register {
  const lower = style.toLowerCase();
  if (/technical|precise|evidence|data|engineer/.test(lower)) return 'technical';
  if (/direct|blunt|plain|frank/.test(lower)) return 'direct';
  return 'formal';
}

const ADDRESSED: Record<Register, readonly string[]> = {
  formal: ['We thank {player} for putting the question to us.', 'We are grateful to {player} for raising this with us directly.'],
  direct: ['Thank you, {player}.', 'Fair question, {player}.'],
  technical: ['Thank you, {player}. On the substance:', 'To answer {player} directly:'],
};

const EMPTY_TABLE = [
  'There is no text on the table yet, so let us be clear about what we need.',
  'Before a draft is tabled, our position is simple.',
  'We are waiting for a text. In the meantime, one point.',
] as const;

const MISSING_OPENERS: Record<Register, readonly string[]> = {
  formal: [
    'The draft is not yet one this delegation can support.',
    'Something this delegation needs is still absent from the text.',
    'We do not oppose the direction, but the text is incomplete.',
  ],
  direct: ['The text is not there yet.', 'One thing is missing, and it matters to us.', 'We cannot back this as it stands.'],
  technical: [
    'From a testing standpoint the draft has a gap.',
    'The text leaves a practical question open.',
    'As drafted, this would not work in practice for us.',
  ],
};

const OPPOSE_OPENERS = [
  '"{clause}" does not work for us as drafted.',
  'We have a difficulty with one clause: "{clause}."',
  'As written, "{clause}" falls short for us.',
] as const;

const RED_LINE_CLOSERS: Record<Register, readonly string[]> = {
  formal: [
    'On this point our instructions leave no room.',
    'This delegation cannot put its name to a text that contains it.',
    'While that clause stands, we will vote against the text.',
  ],
  direct: ['That is a no from us.', 'Keep that clause and you lose our vote.', 'We will vote against any text that includes it.'],
  technical: [
    'No verification benefit justifies that risk.',
    'There are other ways to get the same assurance; this one we cannot accept.',
    'While that clause stands, we will vote against the text.',
  ],
};

const PARTIAL_SUPPORT = [
  'The rest of the text we can work with.',
  'Other parts of the draft are moving in the right direction.',
  'We acknowledge the progress on the other clauses.',
] as const;

const SUPPORT: Record<Register, readonly string[]> = {
  formal: [
    'The text as it stands is one this delegation can support.',
    'We are in a position to join consensus on the current draft.',
    'We see our concerns reflected and can support the text.',
  ],
  direct: ['We can back this.', 'This works for us.', 'No objection from us on the current text.'],
  technical: [
    'The draft is workable as written.',
    'We can support the text; it can be implemented and checked.',
    'Nothing in the current draft is a problem for us.',
  ],
};

const SOFTENED = [
  'What was said about "{label}" gives us more room than we came with.',
  'On "{label}", the argument we heard makes this easier for us.',
  'We have taken note of the argument on "{label}"; it narrows the gap.',
] as const;

const AMEND = [
  'We are tabling an amendment to that effect.',
  'We propose a change to the text accordingly.',
  'We suggest the wording be amended; our proposal is with the chair.',
] as const;

function amendmentFor(input: DelegateInput, needs: MustHave[]): DelegateOutput['amendment'] {
  if (input.round % 2 !== 0 || input.missing.length === 0) return undefined;
  for (const need of needs) {
    if (!input.missing.some(item => item.label === need.label)) continue;
    const { clause, param, equals, in: values } = need.when;
    const value = equals ?? values?.[0];
    if (clause && param && value !== undefined && input.amendable_templates.includes(clause)) {
      return { template: clause, params: { [param]: value }, note: need.label };
    }
  }
  return undefined;
}

export function createMockRoles(config: GameConfig): LlmRoles {
  const name = (id: string): string => config.delegations.find(item => item.id === id)?.name ?? id;

  return {
    async delegate(input) {
      const delegation = config.delegations.find(item => item.id === input.delegation);
      const register = registerOf(delegation?.style ?? '');
      const key = `${input.delegation}:${input.track}:${input.cycle}:${input.round}`;
      const needs = [...(delegation?.must_haves ?? [])].sort((a, b) => b.weight - a.weight);
      const weightOf = (label: string): number => needs.find(need => need.label === label)?.weight ?? 0;
      const missing = [...input.missing].sort((a, b) => weightOf(b.label) - weightOf(a.label));
      const redLine = input.clauses.find(clause => clause.position === 'red_line');
      const opposed = input.clauses.find(clause => clause.position === 'oppose');
      const supported = input.clauses.filter(clause => clause.position === 'support');
      const amendment = amendmentFor(input, needs);
      const parts: string[] = [];

      if (input.addressed) {
        const asker = [...input.recent].reverse().find(message => message.from_player)?.speaker;
        const player = asker && config.delegations.some(item => item.id === asker) ? name(asker) : 'our colleague';
        parts.push(pick(ADDRESSED[register], key).replace('{player}', player));
      }

      if (redLine) {
        parts.push(`The draft says: "${quote(redLine.text)}."`);
        parts.push(sentence(redLine.reason ?? 'We cannot accept that clause'));
        parts.push(pick(RED_LINE_CLOSERS[register], key));
      } else if (opposed) {
        parts.push(pick(OPPOSE_OPENERS, key).replace('{clause}', quote(opposed.text)));
        parts.push(sentence(opposed.reason ?? missing[0]?.say ?? 'It does not meet what we need'));
      } else if (missing.length > 0) {
        parts.push(input.clauses.length === 0 ? pick(EMPTY_TABLE, key) : pick(MISSING_OPENERS[register], key));
        parts.push(sentence(missing[0].say));
        if (supported.length > 0) parts.push(pick(PARTIAL_SUPPORT, key));
      } else {
        parts.push(pick(SUPPORT[register], key));
        if (supported[0]) parts.push(`We note in particular: "${quote(supported[0].text)}."`);
      }

      if (!redLine && input.softened.length > 0 && (opposed || missing.length > 0)) {
        parts.push(pick(SOFTENED, key).replace('{label}', input.softened[0]));
      }
      if (amendment) parts.push(pick(AMEND, key));

      const speech = parts.join(' ').slice(0, 900);
      return { speech, ...(amendment ? { amendment } : {}), fallback: false };
    },

    async tagger(input) {
      const text = input.player_text.toLowerCase();
      const stopWords = new Set([
        'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'for', 'from', 'has', 'in', 'is', 'it', 'of',
        'on', 'or', 'our', 'that', 'the', 'their', 'this', 'to', 'we', 'with', 'without', 'propose', 'proposes',
        'proposing', 'offers', 'points', 'out',
      ]);
      const wordsOf = (value: string): string[] => value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
      const playerWords = new Set(wordsOf(text));
      const tags = config.tags
        .flatMap(tag => {
          const exampleMatch = tag.examples.some(example => example.trim() && text.includes(example.trim().toLowerCase()));
          if (exampleMatch) return [{ tag: tag.id, confidence: 0.9 }];
          const distinctive = new Set(
            wordsOf(`${tag.label} ${tag.description}`).filter(word => word.length > 2 && !stopWords.has(word)),
          );
          const matches = [...distinctive].filter(word => playerWords.has(word)).length;
          return matches >= 2 ? [{ tag: tag.id, confidence: 0.7 }] : [];
        })
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 2);
      return { tags, fallback: false };
    },

    async rapporteur(input) {
      const total = input.clauses.length;
      const opposedBy = new Map<string, string[]>();
      for (const position of input.positions) {
        for (const clause of position.opposes) {
          opposedBy.set(clause, [...(opposedBy.get(clause) ?? []), name(position.delegation)]);
        }
      }
      const contested = opposedBy.size;
      const where = input.track === 2 ? 'Expert channel' : `${ordinal(input.cycle)} cycle`;
      const table = `${total} clause${total === 1 ? '' : 's'} on the table, ${input.positions.length} delegation${input.positions.length === 1 ? '' : 's'} present`;
      const state =
        total === 0
          ? 'No text was tabled.'
          : contested === 0
            ? 'No delegation recorded an objection to any clause.'
            : `${contested} of ${total} clause${total === 1 ? '' : 's'} remain${contested === 1 ? 's' : ''} contested.`;
      const objection = input.objection
        ? ` Following an objection, the record is corrected to note: "${input.objection.trim()}"`
        : '';
      return {
        summary: `${where}: ${table}. ${state}${objection}`,
        positions: input.positions.map(position => {
          const cannot = position.opposes.map(clause => `"${quote(clause, 90)}"`).join('; ');
          const text =
            position.opposes.length === 0
              ? position.supports.length > 0
                ? 'Can accept the text as tabled.'
                : 'Took no position on the tabled clauses.'
              : `Cannot accept ${cannot}.${position.supports.length > 0 ? ` Supports ${position.supports.length} other clause${position.supports.length === 1 ? '' : 's'}.` : ''}`;
          return { delegation: position.delegation, text };
        }),
        open_issues: [...opposedBy.entries()].map(([clause, names]) => `${quote(clause, 90)}: opposed by ${names.join(', ')}`),
        fallback: false,
      };
    },

    async declineLetter(input) {
      const reasons = input.reasons.map(sentence).join(' ');
      const who = name(input.delegation);
      const letter =
        input.status === 'excluded'
          ? `${who} notes that it has not been invited to the ${input.forum_name}. ${reasons} Arrangements made without us cannot bind us, and we will take the matter up in other settings.`
          : `${who} thanks the convenor for the invitation to the ${input.forum_name}. After consulting our capital, we regret that we cannot take part. ${reasons} We remain open to a format that addresses these concerns.`;
      return { letter: letter.replace(/\s+/g, ' ').trim(), fallback: false };
    },

    async voteStatement(input) {
      let statement: string;
      if (input.vote === 'no') {
        const reason = input.red_lines[0] ?? input.missing[0];
        statement = reason ? `We vote against. ${sentence(reason)}` : 'We vote against. The text does not meet what we need.';
        if (input.red_lines.length === 0 && input.in_swing_band) statement += ' It was a close decision.';
      } else {
        const won = input.satisfied.slice(0, 2).map(lowerFirst).join(' and ');
        const because = won
          ? pick([`The text secures ${won}.`, `We came for ${won}, and it is in the text.`, `With ${won} in the text, we can sign.`], input.delegation)
          : 'We see no obstacle in the text.';
        statement = `We vote in favour. ${because}`;
        if (input.missing[0]) statement += ` We record one regret: ${sentence(input.missing[0])}`;
      }
      return { statement, adjust: 0, fallback: false };
    },
  };
}
