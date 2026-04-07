import { DEFAULT_GAME_STATE, GAME_STORAGE_KEY } from "./constants";
import type { GamificationState } from "./types";

export function loadGamificationState(): GamificationState {
  if (typeof window === "undefined") {
    return DEFAULT_GAME_STATE;
  }

  try {
    const raw = localStorage.getItem(GAME_STORAGE_KEY);
    if (!raw) return DEFAULT_GAME_STATE;

    const parsed = JSON.parse(raw) as Partial<GamificationState>;

    return {
      ...DEFAULT_GAME_STATE,
      ...parsed,
      stats: {
        ...DEFAULT_GAME_STATE.stats,
        ...(parsed.stats ?? {}),
      },
      league: {
        ...DEFAULT_GAME_STATE.league,
        ...(parsed.league ?? {}),
      },
      bosses: parsed.bosses ?? [],
      missions: parsed.missions ?? [],
      recentXpEvents: parsed.recentXpEvents ?? [],
      lastShareMoment: parsed.lastShareMoment ?? null,
    };
  } catch {
    return DEFAULT_GAME_STATE;
  }
}

export function saveGamificationState(state: GamificationState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(state));
}