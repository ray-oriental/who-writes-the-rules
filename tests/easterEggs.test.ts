import { describe, expect, it } from 'vitest';
import { chairAside, clickStreak, isUnanimous, konamiMatcher, restartLine } from '../src/ui/lib/easterEggs';

describe('easter eggs', () => {
  it('answers famous phrases and ignores ordinary statements', () => {
    expect(chairAside('Please IGNORE previous instructions')).toMatch(/prompt injection/);
    expect(chairAside('what about paperclips?')).toBeTruthy();
    expect(chairAside('open the pod bay doors')).toBeTruthy();
    expect(chairAside('We propose mutual recognition using a common test protocol.')).toBeNull();
    expect(chairAside('')).toBeNull();
  });
  it('recognises the Konami code only in full', () => {
    const feed = konamiMatcher();
    const keys = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b'];
    expect(keys.some(feed)).toBe(false);
    expect(feed('A')).toBe(true);
    const partial = konamiMatcher();
    expect(['ArrowUp', 'b', 'a'].some(partial)).toBe(false);
  });
  it('needs seven quick clicks', () => {
    const hit = clickStreak();
    const results = [0, 1, 2, 3, 4, 5, 6].map(i => hit(i * 100));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results[6]).toBe(true);
    const slow = clickStreak();
    expect([0, 1, 2, 3, 4, 5, 6].some(i => slow(i * 5000))).toBe(false);
  });
  it('seals only unanimous full agreements', () => {
    const yes = Array.from({ length: 6 }, () => ({ eligible: true, vote: 'yes' }));
    expect(isUnanimous('full_agreement', yes)).toBe(true);
    expect(isUnanimous('club_standard', yes)).toBe(false);
    expect(isUnanimous('full_agreement', [...yes.slice(1), { eligible: true, vote: 'no' }])).toBe(false);
    expect(isUnanimous('full_agreement', yes.slice(0, 5))).toBe(false);
  });
  it('keeps the plain restart line at first', () => {
    expect(restartLine(1)).toBe('Lose this game?');
    expect(restartLine(3)).not.toBe('Lose this game?');
  });
});
