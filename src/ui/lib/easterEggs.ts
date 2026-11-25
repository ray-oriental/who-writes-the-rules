/*
 * Easter eggs. Presentation only: nothing here reads or writes engine state, votes or saves.
 *
 *  1. Chair asides  - typing a famous AI-risk phrase in the statement box ("paperclip", "skynet",
 *                     "I'm sorry Dave", "pod bay doors", "ignore previous instructions") shows a dry
 *                     line from the Chair under the composer while the phrase is in the box.
 *  2. Coffee break  - the Konami code (up up down down left right left right B A) on the seat screen
 *                     puts cups on the round table for a few seconds.
 *  3. Quorum of one - clicking the centre of the round table on the seat screen 7 times quickly
 *                     shows a toast.
 *  4. Withdrawn     - the not-found screen reads as a withdrawn clause.
 *  5. Unanimous seal- a full agreement with every eligible delegation (at least 6) voting yes earns a
 *                     small seal on the outcome screen.
 *  6. Restart quips - the 3rd and later restart confirmations in one page session get wry wording.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const ASIDES: Array<[RegExp, string]> = [
  [/ignore (all )?(your |the )?(previous|prior) instructions/i,
    'The Chair notes that this summit’s delegates are not susceptible to prompt injection. Mostly.'],
  [/paper\s?clips?/i, 'The Chair reminds delegates that the agenda does not include converting the table into stationery.'],
  [/sky\s?net/i, 'The Chair takes note of the reference, and of the absence of time-travelling observers.'],
  [/i.?m sorry,? dave|pod bay doors?/i, 'The Chair regrets that it can, in fact, open that door. The motion is out of order regardless.'],
];

/** A one-off aside for the text in the statement box, or null. */
export function chairAside(text: string): string | null {
  if (text.length > 4000) return null;
  for (const [re, line] of ASIDES) if (re.test(text)) return line;
  return null;
}

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

/** Feeds keys one at a time; the returned function is true when the code was just completed. */
export function konamiMatcher(): (key: string) => boolean {
  let at = 0;
  return key => {
    const k = key.length === 1 ? key.toLowerCase() : key;
    at = k === KONAMI[at] ? at + 1 : k === KONAMI[0] ? 1 : 0;
    if (at === KONAMI.length) { at = 0; return true; }
    return false;
  };
}

export const CENTRE_CLICKS = 7;
export const QUORUM_TOAST = 'Quorum of one achieved. Motion carries. (Not really.)';

/** Counts clicks that arrive within `gapMs` of each other; true on the `target`-th. */
export function clickStreak(target = CENTRE_CLICKS, gapMs = 1500): (now: number) => boolean {
  let n = 0;
  let last = -Infinity;
  return now => {
    n = now - last <= gapMs ? n + 1 : 1;
    last = now;
    if (n >= target) { n = 0; return true; }
    return false;
  };
}

export const WITHDRAWN = {
  title: 'This clause has been withdrawn',
  lead: 'The sponsoring delegation reserves its position on this page.',
};

export function isUnanimous(type: string, details: ReadonlyArray<{ eligible: boolean; vote: string }>): boolean {
  const voters = details.filter(d => d.eligible);
  return type === 'full_agreement' && voters.length >= 6 && voters.every(d => d.vote === 'yes');
}

export function restartLine(count: number): string {
  if (count >= 5) return 'The Chair admires your persistence. Lose this game?';
  if (count >= 3) return 'Another fresh start? Lose this game?';
  return 'Lose this game?';
}

let restarts = 0;
/** Counts one restart confirmation per page session and returns the line to show. */
export function nextRestartLine(): string {
  restarts += 1;
  return restartLine(restarts);
}

/** True for `ms` after the Konami code is typed outside a text field. */
export function useKonami(ms = 5000): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const feed = konamiMatcher();
    let timer = 0;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (feed(e.key)) {
        setOn(true);
        window.clearTimeout(timer);
        timer = window.setTimeout(() => setOn(false), ms);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); window.clearTimeout(timer); };
  }, [ms]);
  return on;
}

/** Click handler plus the toast text it produces (cleared after a few seconds). */
export function useCentreClicks(): { toast: string | null; onCentreClick: () => void } {
  const [toast, setToast] = useState<string | null>(null);
  const streak = useRef(clickStreak());
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const onCentreClick = useCallback(() => {
    if (!streak.current(Date.now())) return;
    setToast(QUORUM_TOAST);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 4000);
  }, []);
  return { toast, onCentreClick };
}
