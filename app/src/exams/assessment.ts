export const PLACEMENT_STEP_SIZE = 5;
export const PLACEMENT_MAX_ITEMS = 25;

export function nextPlacementLevel(
  levels: readonly string[],
  currentLevel: string,
  correct: number,
): string | undefined {
  const index = levels.indexOf(currentLevel);
  if (index < 0 || correct === 3) return undefined;
  const next = correct >= 4 ? index + 1 : index - 1;
  return levels[next];
}

export function scoreModuleExam(correct: number, total = 16): { score: number; passed: boolean } {
  const score = total === 0 ? 0 : correct / total;
  return { score, passed: score >= 0.8 };
}

export function scoreLevelExam(
  writtenCorrect: number,
  listeningCorrect: number,
  listeningAvailable: boolean,
): { score: number; passed: boolean; withoutListening: boolean } {
  // A failed TTS calibration swaps in six written items, so the exam remains
  // equally long and equally demanding rather than becoming easier.
  const total = 36;
  const correct = writtenCorrect + (listeningAvailable ? listeningCorrect : 0);
  const score = correct / total;
  return {
    score,
    passed: score >= 0.8 && (!listeningAvailable || listeningCorrect >= 4),
    withoutListening: !listeningAvailable,
  };
}
