import { Router } from "express";
import type { Restaurant } from "@prisma/client";
import { prisma } from "../prisma";
import { ai } from "../openrouter";
import { spaceByCuisine } from "../utils/spacing";

export const spinnerRouter = Router();

/** Fair ordering: never visited first, then oldest lastVisited first, then stable id */
function compareFair(a: Restaurant, b: Restaurant): number {
  if (a.lastVisited == null && b.lastVisited != null) return -1;
  if (a.lastVisited != null && b.lastVisited == null) return 1;
  if (a.lastVisited != null && b.lastVisited != null) {
    const diff = a.lastVisited.getTime() - b.lastVisited.getTime();
    if (diff !== 0) return diff;
  }
  return a.id - b.id;
}

function fallbackEight(all: Restaurant[]): Restaurant[] {
  return [...all].sort(compareFair).slice(0, 8);
}

function normalizeToEight(all: Restaurant[], picked: Restaurant[]): Restaurant[] {
  const byId = new Map<number, Restaurant>(all.map((r) => [r.id, r]));
  const seen = new Set<number>();
  const out: Restaurant[] = [];

  for (const r of picked) {
    const full = byId.get(r.id);
    if (!full || seen.has(r.id)) continue;
    out.push(full);
    seen.add(r.id);
    if (out.length >= 8) break;
  }

  if (out.length < 8 && all.length > out.length) {
    const filler = [...all].filter((r) => !seen.has(r.id)).sort(compareFair);
    for (const r of filler) {
      if (out.length >= 8) break;
      out.push(r);
      seen.add(r.id);
    }
  }

  return out.slice(0, 8);
}

async function pickWithAi(all: Restaurant[]): Promise<number[]> {
  if (!ai) return [];

  const payload = all.map((r) => ({
    id: r.id,
    name: r.name,
    cuisine: r.cuisine,
    lastVisited: r.lastVisited?.toISOString() ?? null,
  }));

  const completion = await ai.chat.completions.create({
    model: "openai/gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a fair lunch coordinator. From the user's JSON array of restaurants, choose exactly 8 distinct restaurant IDs. Prioritize venues with lastVisited null (never picked) first, then those with oldest lastVisited timestamps. Prefer variety of cuisines where ties exist. Respond ONLY with a JSON object: {\"ids\":[number,...]} containing exactly 8 unique integers matching ids from the input.",
      },
      {
        role: "user",
        content: JSON.stringify(payload),
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.35,
    max_tokens: 400,
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  const parsed = JSON.parse(raw) as { ids?: unknown };
  const ids = Array.isArray(parsed.ids)
    ? parsed.ids.filter((x): x is number => typeof x === "number")
    : [];
  return ids;
}

/**
 * GET /api/spinner-options
 * Returns 8 restaurants spaced so same cuisine rarely sits adjacent (when feasible).
 */
spinnerRouter.get("/spinner-options", async (_req, res) => {
  try {
    const all = await prisma.restaurant.findMany({ orderBy: { id: "asc" } });

    if (all.length === 0) {
      return res.json({ restaurants: [] });
    }

    if (all.length <= 8) {
      const spaced = spaceByCuisine(all);
      return res.json({ restaurants: spaced });
    }

    let chosen: Restaurant[];

    try {
      if (ai && process.env.OPENROUTER_API_KEY) {
        const idsFromAi = await pickWithAi(all);
        const map = new Map(all.map((r) => [r.id, r]));
        const hydrated = idsFromAi
          .map((id) => map.get(id))
          .filter((r): r is Restaurant => r != null);
        chosen = normalizeToEight(all, hydrated);
        if (chosen.length < 8) {
          chosen = fallbackEight(all);
        }
      } else {
        chosen = fallbackEight(all);
      }
    } catch {
      chosen = fallbackEight(all);
    }

    const spaced = spaceByCuisine(chosen);
    return res.json({ restaurants: spaced });
  } catch (e) {
    console.error("spinner-options", e);
    return res.status(500).json({ error: "Failed to load spinner options" });
  }
});
