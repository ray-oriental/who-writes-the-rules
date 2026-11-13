import type { ReactNode } from 'react';
import { cx } from '../lib/delegations';
import './Document.css';

export interface DocumentProps {
  /** Small caps line above the title: "Delegation brief", "Draft resolution", "Note verbale". */
  kicker?: ReactNode;
  /** Document symbol in the top-right corner, e.g. "WWTR/1/CN". */
  symbol?: ReactNode;
  title?: ReactNode;
  /** Header rows, e.g. [["To", "..."], ["Re", "..."]]. */
  meta?: [ReactNode, ReactNode][];
  /** Element in the letterhead's left slot, usually a DelegationBadge. */
  seal?: ReactNode;
  /** compact: a letter in a list (decline letters). full: a page (role card, report). */
  size?: 'compact' | 'full';
  children: ReactNode;
  className?: string;
  /** Wraps the whole document; use 'article' when it stands alone. */
  as?: 'article' | 'div' | 'section';
  'aria-label'?: string;
  /** Heading level of the title; use 'h1' when the document is the whole screen. */
  titleAs?: 'h1' | 'h2' | 'h3';
}

/**
 * The formal paper: serif type, numbered paragraphs, set like a draft resolution.
 * Use it for every text that is "a document in the world": briefs, reports, letters, proposals, annexes.
 */
export function Document({
  kicker,
  symbol,
  title,
  meta,
  seal,
  size = 'full',
  children,
  className,
  as: Tag = 'article',
  titleAs: TitleTag = 'h2',
  ...aria
}: DocumentProps) {
  return (
    <Tag className={cx('doc', `doc--${size}`, className)} {...aria}>
      {(kicker || symbol || seal) && (
        <div className="doc__letterhead">
          {seal && <div className="doc__seal">{seal}</div>}
          {kicker && <p className="doc__kicker">{kicker}</p>}
          {symbol && <p className="doc__symbol">{symbol}</p>}
        </div>
      )}
      {title && <TitleTag className="doc__title">{title}</TitleTag>}
      {meta && meta.length > 0 && (
        <dl className="doc__meta">
          {meta.map(([k, v], i) => (
            <div className="doc__meta-row" key={i}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="doc__body">{children}</div>
    </Tag>
  );
}

/** Numbered part of a document: "2.  Red lines". */
export function DocSection({ n, title, children }: { n?: ReactNode; title: ReactNode; children: ReactNode }) {
  return (
    <section className="doc__section">
      <h3 className="doc__section-title">
        <span className="doc__n">{n}</span>
        <span>{title}</span>
      </h3>
      {children}
    </section>
  );
}

/**
 * One numbered paragraph with a hanging number ("2.1"). `lead` is set in italics before the text,
 * like the operative verbs of a resolution ("Decides", "Requests").
 */
export function DocPara({
  n,
  lead,
  children,
  aside,
}: {
  n?: ReactNode;
  lead?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="doc__para">
      <span className="doc__n" aria-hidden={n === undefined ? true : undefined}>
        {n}
      </span>
      <div className="doc__para-text">
        <div className="doc__para-p">
          {lead && <em className="doc__lead">{lead} </em>}
          {children}
        </div>
        {aside && <div className="doc__para-aside">{aside}</div>}
      </div>
    </div>
  );
}

/** A delegation's own words, quoted: the `say` sentences. */
export function DocQuote({ children }: { children: ReactNode }) {
  return <blockquote className="doc__quote">{children}</blockquote>;
}

/** Closing line of a letter. */
export function DocSignature({ children }: { children: ReactNode }) {
  return <p className="doc__signature">{children}</p>;
}
