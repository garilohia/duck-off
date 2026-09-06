// Saved preferences live in localStorage, which can be missing, full, or blocked (private browsing,
// embedded webviews, storage quotas). Every access is guarded so the game never trips over it.

export function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Nothing to do: the preference simply is not remembered this time.
  }
}

export function readFlag(key: string): boolean {
  return readPref(key) === '1';
}

export function writeFlag(key: string, on: boolean): void {
  writePref(key, on ? '1' : '0');
}

export const PREF = {
  name: 'duckoff_name',
  duck: 'duckoff_duck',
  muted: 'duckoff_muted',
  howTo: 'duckoff_howto_v2',
} as const;
