/**
 * Deterministic Mulberry32 PRNG.
 * Given an integer seed state, returns `{ value: [0, 1), nextSeed }`.
 * Pure functional design lets GameState remain 100% JSON-serializable for DB snapshots & replays.
 */
export function nextRandom(seed: number): { value: number; nextSeed: number } {
  let t = (seed + 0x6d2b79f5) | 0;
  const nextSeed = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, nextSeed };
}

export function shuffleDeterministic<T>(
  items: readonly T[],
  seed: number
): { shuffled: T[]; nextSeed: number } {
  const arr = [...items];
  let s = seed | 0;
  for (let i = arr.length - 1; i > 0; i--) {
    const r = nextRandom(s);
    s = r.nextSeed;
    const j = Math.floor(r.value * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return { shuffled: arr, nextSeed: s };
}
