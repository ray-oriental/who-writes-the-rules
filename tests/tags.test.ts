import { describe, expect, it } from 'vitest';
import * as engine from '../src/engine';
import { createLlmRoles, DEFAULT_LLM_SETTINGS } from '../src/llm';

const loaded = engine.loadConfig();
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const { config } = loaded;
const roles = createLlmRoles(config, () => DEFAULT_LLM_SETTINGS);

async function recognise(text: string): Promise<string[]> {
  const result = await roles.tagger({ player_text: text } as Parameters<typeof roles.tagger>[0]);
  return result.tags.map(hit => hit.tag);
}

const sentences: Record<string, { en: string[]; zh: string[] }> = {
  verify_without_weights: {
    en: [
      'We propose structured access, so testers can verify the results while the weights stay private.',
      'An audit can run inside a secure enclave and nobody needs to hand over the weights.',
      'Independent testing through an API lets us check the model without releasing the weights.',
    ],
    zh: ['我们建议受控测试访问，这样可以验证模型，同时不公开权重。', '通过接口测试就能完成检查，而且保护模型权重。'],
  },
  measurement_error: {
    en: [
      'Any score should come with error bars, otherwise nobody knows how much to trust it.',
      'We worry about benchmark gaming and test set contamination in this evaluation.',
      'Please report the confidence interval and the margin of error for each number.',
    ],
    zh: ['每个分数都应该附带置信区间，否则无法判断可信度。', '我们担心测试集污染，也担心测量误差被低估。'],
  },
  capacity_support: {
    en: [
      'Capacity building is the missing piece: many countries cannot run these tests today.',
      'We can fund evaluator training and set up regional testing centres.',
      'Offering shared compute access and technical assistance would let every delegation take part.',
    ],
    zh: ['我们愿意提供能力建设支持，包括培训评估人员。', '建议设立区域测试中心，并提供共享算力。'],
  },
  mutual_recognition: {
    en: [
      'Mutual recognition would spare every lab from repeating the same tests in each country.',
      'Each side should accept each other\'s results if they follow one protocol.',
      'We suggest a common test protocol with reciprocal acceptance of national reports.',
    ],
    zh: ['我们提议各国互认测试结果，避免重复检测。', '双方应当承认对方的测试结果，并采用统一测试协议。'],
  },
  sovereignty_respect: {
    en: [
      'This text must show respect for sovereignty, so national institutions run the tests.',
      'Each country runs its own tests and we only exchange results that others can review.',
      'We insist on domestic execution and the right to retain national control over the process.',
    ],
    zh: ['这份文本必须尊重主权，由各国自行测试。', '我们主张本国机构执行测试，并且只交换结果。'],
  },
};

const neutral = [
  'Thank you, chair.',
  'We should move on to the next item.',
  'Let us be constructive.',
  '我们同意继续讨论。',
  'The weather in Geneva is fine.',
];

describe('argument tags (offline tagger)', () => {
  it('covers every shipped tag', () => {
    expect(config.tags.map(tag => tag.id).sort()).toEqual(Object.keys(sentences).sort());
  });

  for (const tag of Object.keys(sentences)) {
    const { en, zh } = sentences[tag]!;
    for (const text of [...en, ...zh]) {
      it(`${tag}: ${text}`, async () => {
        expect(await recognise(text)).toContain(tag);
      });
    }
  }

  for (const text of neutral) {
    it(`neutral: ${text}`, async () => {
      expect(await recognise(text)).toEqual([]);
    });
  }

  it('keeps every phrase specific enough', () => {
    for (const tag of config.tags) {
      expect(tag.examples.length).toBeGreaterThanOrEqual(14);
      for (const phrase of tag.examples) expect(phrase.trim().length).toBeGreaterThanOrEqual(2);
    }
  });
});
