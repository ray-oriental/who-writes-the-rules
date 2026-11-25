import { useState } from 'react';
import { useConfig, useGame } from '../../game/context';
import { Button } from '../components/Button';
import { TextArea } from '../components/Forms';
import { ScreenHead } from '../components/Misc';
import './Quiz.css';

/** Post-game quiz (the pre kind is kept for old saves). Skip and Finish both submit; blank answers are allowed. */
export function QuizScreen({ kind }: { kind: 'pre' | 'post' }) {
  const { config } = useConfig();
  const { view, actions } = useGame();
  const questions = config.quiz.questions;
  const [answers, setAnswers] = useState<string[]>(() => questions.map((_, i) => view.state.quiz[kind]?.[i] ?? ''));
  const busy = !!view.busy;
  const answered = answers.filter((a) => a.trim()).length;

  return (
    <div className="l-page l-page--narrow quiz">
      <ScreenHead
        eyebrow={kind === 'pre' ? 'Before the summit' : 'After the summit'}
        title={
          kind === 'pre'
            ? questions.length === 1
              ? 'One question first'
              : 'A few questions first'
            : 'Before you go'
        }
        lead={
          kind === 'pre'
            ? 'Answer in a sentence or two. There are no right answers; you will see these again at the end.'
            : 'Optional. A sentence each is plenty, and blank answers are fine.'
        }
      />
      <form
        className="quiz__form"
        onSubmit={(e) => {
          e.preventDefault();
          actions.submitQuiz(
            kind,
            answers.map((a) => a.trim()),
          );
        }}
      >
        <ol className="quiz__list">
          {questions.map((q, i) => {
            const prev = kind === 'post' ? view.state.quiz.pre?.[i] : undefined;
            return (
              <li key={q.id} className="quiz__item">
                <label className="quiz__question" htmlFor={`quiz-${q.id}`}>
                  <span className="quiz__n t-num">{i + 1}</span>
                  {q.text}
                </label>
                {prev && (
                  <p className="quiz__prev">
                    <span className="t-eyebrow">You said before</span> {prev}
                  </p>
                )}
                <TextArea
                  id={`quiz-${q.id}`}
                  rows={3}
                  value={answers[i]}
                  disabled={busy}
                  onChange={(e) => {
                    const next = [...answers];
                    next[i] = e.target.value;
                    setAnswers(next);
                  }}
                />
              </li>
            );
          })}
        </ol>
        <div className="l-actions l-actions--end">
          {kind === 'post' && (
            <Button
              type="button"
              variant="quiet"
              disabled={busy}
              onClick={() => actions.submitQuiz(kind, answers.map((a) => a.trim()))}
            >
              Skip
            </Button>
          )}
          <span className="t-meta quiz__count t-num">
            {kind === 'pre' ? `${answered} of ${questions.length} answered` : 'All questions are optional'}
          </span>
          <Button type="submit" variant="primary" size="lg" icon="arrow-right" disabled={busy}>
            {kind === 'pre' ? 'Submit and convene' : 'Finish'}
          </Button>
        </div>
      </form>
    </div>
  );
}
