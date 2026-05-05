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
 * Returns all restaurants spaced so same cuisine rarely sits adjacent (when feasible).
 */
spinnerRouter.get("/spinner-options", async (_req, res) => {
  try {
    const all = await prisma.restaurant.findMany({ orderBy: { id: "asc" } });

    if (all.length === 0) {
      return res.json({ restaurants: [] });
    }

    const spaced = spaceByCuisine(all);
    return res.json({ restaurants: spaced });
  } catch (e) {
    console.error("spinner-options", e);
    return res.status(500).json({ error: "Failed to load spinner options" });
  }
});

// GET /api/restaurants - List all restaurants
spinnerRouter.get("/restaurants", async (_req, res) => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      orderBy: { name: "asc" },
    });
    res.json({ restaurants });
  } catch (e) {
    console.error("get restaurants", e);
    res.status(500).json({ error: "Failed to load restaurants" });
  }
});

// POST /api/restaurants - Add a new restaurant
spinnerRouter.post("/restaurants", async (req, res) => {
  try {
    const { name, cuisine } = req.body;
    if (!name || !cuisine) {
      return res.status(400).json({ error: "Name and cuisine are required" });
    }
    const restaurant = await prisma.restaurant.create({
      data: { name, cuisine },
    });
    res.json({ restaurant });
  } catch (e) {
    console.error("create restaurant", e);
    res.status(500).json({ error: "Failed to create restaurant" });
  }
});

// PUT /api/restaurants/:id - Update a restaurant
spinnerRouter.put("/restaurants/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, cuisine } = req.body;
    if (!name || !cuisine) {
      return res.status(400).json({ error: "Name and cuisine are required" });
    }
    const restaurant = await prisma.restaurant.update({
      where: { id },
      data: { name, cuisine },
    });
    res.json({ restaurant });
  } catch (e) {
    console.error("update restaurant", e);
    res.status(500).json({ error: "Failed to update restaurant" });
  }
});

// DELETE /api/restaurants/:id - Delete a restaurant
spinnerRouter.delete("/restaurants/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.restaurant.delete({
      where: { id },
    });
    res.json({ success: true });
  } catch (e) {
    console.error("delete restaurant", e);
    res.status(500).json({ error: "Failed to delete restaurant" });
  }
});
