import type { Restaurant } from "./types";

const API = "";

export async function fetchSpinnerOptions(): Promise<Restaurant[]> {
  const res = await fetch(`${API}/api/spinner-options`);
  if (!res.ok) throw new Error("Failed to load spinner options");
  const data = (await res.json()) as { restaurants: Restaurant[] };
  return data.restaurants;
}

export type VisitRow = {
  id: number;
  date: string;
  totalAmount: string;
  receiptFileUrl: string | null;
  restaurant: { id: number; name: string; cuisine: string };
  splits: { personName: string; amountOwed: string; paid: boolean }[];
};

export async function fetchHistory(): Promise<VisitRow[]> {
  const res = await fetch(`${API}/api/history`);
  if (!res.ok) throw new Error("Failed to load history");
  const data = (await res.json()) as { visits: VisitRow[] };
  return data.visits;
}

export async function postHistory(formData: FormData): Promise<void> {
  const res = await fetch(`${API}/api/history`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    let msg = "Save failed";
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
}

export async function fetchRestaurants(): Promise<Restaurant[]> {
  const res = await fetch(`${API}/api/restaurants`);
  if (!res.ok) throw new Error("Failed to load restaurants");
  const data = (await res.json()) as { restaurants: Restaurant[] };
  return data.restaurants;
}

export async function createRestaurant(name: string, cuisine: string): Promise<Restaurant> {
  const res = await fetch(`${API}/api/restaurants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, cuisine }),
  });
  if (!res.ok) throw new Error("Failed to create restaurant");
  const data = (await res.json()) as { restaurant: Restaurant };
  return data.restaurant;
}

export async function updateRestaurant(id: number, name: string, cuisine: string): Promise<Restaurant> {
  const res = await fetch(`${API}/api/restaurants/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, cuisine }),
  });
  if (!res.ok) throw new Error("Failed to update restaurant");
  const data = (await res.json()) as { restaurant: Restaurant };
  return data.restaurant;
}

export async function deleteRestaurant(id: number): Promise<void> {
  const res = await fetch(`${API}/api/restaurants/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete restaurant");
}
