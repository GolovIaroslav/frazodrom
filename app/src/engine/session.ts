import { checkAnswer } from '../checker/cascade';
import type { HintLevel } from './hints';
import type { PackItem } from './types';
import { requeueItem } from './queue';

export type Phase = 'answer' | 'rewrite' | 'finished';
export type Verdict = 'correct' | 'minor_error' | 'wrong';

export interface AnswerResult {
  verdict: Verdict;
  /** True once the reference has been shown and a REWRITE cycle is required. */
  mustRewrite: boolean;
}

export interface RewriteResult {
  success: boolean;
  /** True after a 2nd consecutive REWRITE fail — reference stays visible (safety valve, §6.1). */
  referenceVisible: boolean;
}

export interface SessionStats {
  total: number;
  correct: number;
}

/**
 * Framework-agnostic drill state machine for a single skill's queue
 * (PLAN.md §6.1). Scope for Ф2: one skill's new sentences only — no
 * interleave/requeue-across-sessions/fluency-sprints (later phases).
 */
export class DrillEngine {
  private queue: PackItem[];
  private index = 0;
  private hintLevel = 0 as 0 | HintLevel;
  private revealed = false;
  private references: string[] = [];
  private rewriteFailStreak = 0;
  private hadWrongAttempt = false;
  private pendingAdvance = false;
  readonly stats: SessionStats = { total: 0, correct: 0 };

  phase: Phase = 'answer';

  constructor(queue: readonly PackItem[]) {
    this.queue = [...queue];
    if (this.queue.length === 0) this.phase = 'finished';
  }

  get currentItem(): PackItem | undefined {
    return this.queue[this.index];
  }

  get remaining(): number {
    return Math.max(0, this.queue.length - this.index);
  }

  get currentHintLevel(): 0 | HintLevel {
    return this.hintLevel;
  }

  get isReferenceVisible(): boolean {
    return this.revealed;
  }

  /** True after a correct first-try answer: a second Enter (§6.4) moves on. */
  get isPendingAdvance(): boolean {
    return this.pendingAdvance;
  }

  /** Moves to the next item once a correct answer's feedback has been shown. */
  advance(): void {
    if (!this.pendingAdvance) return;
    this.pendingAdvance = false;
    this.advanceToNext();
  }

  requestHint(): HintLevel {
    this.hintLevel = this.hintLevel === 2 ? 2 : ((this.hintLevel + 1) as HintLevel);
    return this.hintLevel;
  }

  /** Reveals the reference answer (give up / error explanation) — forces REWRITE next. */
  giveUp(): string[] {
    const item = this.requireItem();
    this.references = [item.en_main, ...item.en_accepted];
    this.revealed = true;
    this.phase = 'rewrite';
    this.rewriteFailStreak = 0;
    this.hadWrongAttempt = true;
    return this.references;
  }

  submitAnswer(userInput: string): AnswerResult {
    const item = this.requireItem();
    if (this.phase !== 'answer') {
      throw new Error('submitAnswer called outside the answer phase');
    }

    const result = checkAnswer({
      userInput,
      ruStimulus: item.ru,
      enMain: item.en_main,
      enAccepted: item.en_accepted,
    });

    if (result.verdict === 'correct' && !result.tag) {
      this.stats.total += 1;
      this.stats.correct += 1;
      this.pendingAdvance = true;
      return { verdict: 'correct', mustRewrite: false };
    }

    if (result.verdict === 'correct' && result.tag === 'spelling') {
      // Minor error: correction is shown, so REWRITE is required (§6.1).
      this.stats.total += 1;
      this.stats.correct += 1;
      this.references = [item.en_main, ...item.en_accepted];
      this.revealed = true;
      this.phase = 'rewrite';
      this.rewriteFailStreak = 0;
      return { verdict: 'minor_error', mustRewrite: true };
    }

    this.hadWrongAttempt = true;
    return { verdict: 'wrong', mustRewrite: false };
  }

  submitRewrite(userInput: string): RewriteResult {
    if (this.phase !== 'rewrite') {
      throw new Error('submitRewrite called outside the rewrite phase');
    }
    const item = this.requireItem();

    // REWRITE is checked tier 1–2 only, against whatever reference lines
    // were actually shown to the user (§6.1) — not the full accepted list.
    const [primary, ...rest] = this.references.length > 0 ? this.references : [item.en_main];
    const result = checkAnswer({
      userInput,
      ruStimulus: item.ru,
      enMain: primary as string,
      enAccepted: rest,
    });

    if (result.verdict === 'correct') {
      this.rewriteFailStreak = 0;
      this.revealed = false;
      this.stats.total += 1;
      this.stats.correct += 1;
      this.advanceToNext();
      return { success: true, referenceVisible: false };
    }

    this.rewriteFailStreak += 1;
    const referenceVisible = this.rewriteFailStreak >= 2;
    // Reference is (re-)revealed either way per §6.1; the "visible" flag
    // signals the safety valve where it stays up rather than hiding again.
    this.revealed = true;
    return { success: false, referenceVisible };
  }

  private advanceToNext(): void {
    const failedItem = this.hadWrongAttempt ? this.currentItem : undefined;
    this.hintLevel = 0;
    this.revealed = false;
    this.references = [];
    this.hadWrongAttempt = false;

    if (failedItem) {
      this.queue = requeueItem(this.queue, this.index, failedItem);
    }

    this.index += 1;
    this.phase = this.index >= this.queue.length ? 'finished' : 'answer';
  }

  private requireItem(): PackItem {
    const item = this.currentItem;
    if (!item) throw new Error('No current item — session is finished');
    return item;
  }
}
