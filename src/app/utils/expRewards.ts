export type BattleMode = 'normal' | 'event' | 'boss' | 'mega';

const normalizeBattleMode = (mode?: string): BattleMode => {
  if (mode === 'boss' || mode === 'event' || mode === 'mega') {
    return mode;
  }

  return 'normal';
};

const PLAYER_BATTLE_XP: Record<BattleMode, { win: number; lose: number }> = {
  normal: { win: 42, lose: 20 },
  event: { win: 62, lose: 28 },
  boss: { win: 90, lose: 38 },
  mega: { win: 90, lose: 38 },
};

const CAPTURE_SUCCESS_BONUS: Record<BattleMode, number> = {
  normal: 18,
  event: 26,
  boss: 40,
  mega: 40,
};

const CAPTURE_FAIL_CONSOLATION = 8;

export const getPlayerBattleXp = (mode: string | undefined, didWin: boolean): number => {
  const safeMode = normalizeBattleMode(mode);
  return didWin ? PLAYER_BATTLE_XP[safeMode].win : PLAYER_BATTLE_XP[safeMode].lose;
};

export const getPlayerCaptureOutcomeXp = (mode: string | undefined, captureSuccess: boolean): number => {
  const safeMode = normalizeBattleMode(mode);

  if (captureSuccess) {
    return PLAYER_BATTLE_XP[safeMode].win + CAPTURE_SUCCESS_BONUS[safeMode];
  }

  return PLAYER_BATTLE_XP[safeMode].lose + CAPTURE_FAIL_CONSOLATION;
};

export const getPokemonBattleXp = (mode: string | undefined, didWin: boolean): number => {
  const safeMode = normalizeBattleMode(mode);
  return didWin ? PLAYER_BATTLE_XP[safeMode].win : PLAYER_BATTLE_XP[safeMode].lose;
};

export interface GuessingXpBreakdown {
  correctXp: number;
  wrongXp: number;
  streakBonusXp: number;
  totalXp: number;
}

export const getGuessingXpBreakdown = (
  correctCount: number,
  incorrectCount: number,
  bestStreak: number
): GuessingXpBreakdown => {
  const safeCorrect = Math.max(0, Math.floor(correctCount));
  const safeIncorrect = Math.max(0, Math.floor(incorrectCount));
  const safeBestStreak = Math.max(0, Math.floor(bestStreak));

  const correctXp = safeCorrect * 24;
  const wrongXp = safeIncorrect * 10;
  const streakBonusXp = Math.min(20, safeBestStreak * 4);
  const totalXp = correctXp + wrongXp + streakBonusXp;

  return {
    correctXp,
    wrongXp,
    streakBonusXp,
    totalXp,
  };
};
