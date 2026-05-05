/**
 * Orders restaurants so that adjacent entries avoid the same cuisine when possible.
 * Uses a greedy build plus a reconciliation pass swapping later items into place.
 */

export type WithCuisine = { cuisine: string };

function shuffleInPlace<T>(arr: T[], random: () => number = Math.random): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}

function countCuisines<T extends WithCuisine>(items: T[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of items) {
    m.set(r.cuisine, (m.get(r.cuisine) ?? 0) + 1);
  }
  return m;
}

/** Greedy ordering: alternate cuisines by prioritizing cuisines with remaining mass. */
function buildGreedyOrder<T extends WithCuisine>(remaining: T[]): T[] {
  const result: T[] = [];
  const pool = [...remaining];
  let lastCuisine: string | undefined;

  while (pool.length > 0) {
    const countsByCuisine = countCuisines(pool);
    let candidates = pool.filter((r) => r.cuisine !== lastCuisine);
    if (candidates.length === 0) candidates = [...pool];

    candidates.sort((a, b) => {
      const ca = countsByCuisine.get(a.cuisine) ?? 0;
      const cb = countsByCuisine.get(b.cuisine) ?? 0;
      if (cb !== ca) return cb - ca;
      if (a.cuisine !== b.cuisine) return a.cuisine.localeCompare(b.cuisine);
      return Math.random() - 0.5;
    });

    const pick = candidates[0]!;
    const idx = pool.indexOf(pick);
    pool.splice(idx, 1);
    result.push(pick);
    lastCuisine = pick.cuisine;
  }

  return result;
}

/** Fix remaining same-cuisine adjacencies via swaps toward the end of the array. */
function resolveAdjacencyConflicts<T extends WithCuisine>(ordered: T[]): T[] {
  const arr = [...ordered];
  let changed = true;
  let iterations = 0;
  while (changed && iterations < arr.length * 6) {
    changed = false;
    iterations++;

    for (let i = 1; i < arr.length; i++) {
      if (arr[i]!.cuisine !== arr[i - 1]!.cuisine) continue;

      let swapIdx = -1;
      for (let j = i + 1; j < arr.length; j++) {
        if (
          arr[j]!.cuisine !== arr[i]!.cuisine &&
          arr[j]!.cuisine !== arr[i - 1]!.cuisine
        ) {
          swapIdx = j;
          break;
        }
      }
      if (swapIdx < 0) {
        for (let j = i + 1; j < arr.length; j++) {
          if (arr[j]!.cuisine !== arr[i]!.cuisine) {
            swapIdx = j;
            break;
          }
        }
      }

      if (swapIdx >= 0) {
        const t = arr[i]!;
        arr[i] = arr[swapIdx]!;
        arr[swapIdx] = t;
        changed = true;
      }
    }
  }
  return arr;
}

/** Public API for the spinner pipeline after AI selection. */
export function spaceByCuisine<T extends WithCuisine>(restaurants: T[]): T[] {
  if (restaurants.length <= 1) return [...restaurants];
  const copy = [...restaurants];
  shuffleInPlace(copy);
  const greedy = buildGreedyOrder(copy);
  return resolveAdjacencyConflicts(greedy);
}
