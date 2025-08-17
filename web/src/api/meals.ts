import type {
  DayFull,
  MealType,
  EntryType,
  CopyMealPayload,
  HistoryDay,
} from "../types";
import { api } from "./client";
import {
  isOnline,
  loadStore,
  saveStore,
  getCachedDay,
  cacheDay,
  cacheWeight,
  getCachedWeight,
  nextTempId,
  enqueue,
} from "./offline";

export async function getDayFull(date: string) {
  if (!isOnline()) {
    return getCachedDay(date);
  }
  const response = await api.get(`/days/${date}/full`);
  cacheDay(date, response.data);
  return response.data;
}

export async function createMeal(date: string) {
  if (!isOnline()) {
    const day =
      getCachedDay(date) || {
        date,
        meals: [],
        totals: { kcal: 0, protein: 0, fat: 0, carb: 0 },
      };
    const id = nextTempId();
    const meal: MealType = {
      id,
      name: `Meal ${day.meals.length + 1}`,
      date,
      sort_order: day.meals.length,
      entries: [],
      subtotal: { kcal: 0, protein: 0, fat: 0, carb: 0 },
    };
    day.meals.push(meal);
    cacheDay(date, day);
    enqueue({ kind: "createMeal", payload: { date, tempId: id } });
    return meal;
  }
  const response = await api.post("/meals", { date });
  const day = getCachedDay(date);
  if (day) {
    day.meals.push(response.data);
    cacheDay(date, day);
  }
  return response.data;
}

export async function deleteMeal(mealId: number) {
  if (!isOnline()) {
    const store = loadStore();
    for (const day of Object.values(store.days) as DayFull[]) {
      const idx = day.meals.findIndex((m) => m.id === mealId);
      if (idx >= 0) day.meals.splice(idx, 1);
    }
    enqueue({ kind: "deleteMeal", payload: { mealId } });
    saveStore(store);
    return { success: true };
  }
  const response = await api.delete(`/meals/${mealId}`);
  return response.data;
}

export async function updateMeal(mealId: number, payload: { name?: string; sort_order?: number }) {
  if (!isOnline()) {
    const store = loadStore();
    for (const day of Object.values(store.days) as DayFull[]) {
      const meal = day.meals.find((m) => m.id === mealId);
      if (meal) Object.assign(meal, payload);
    }
    enqueue({ kind: "updateMeal", payload: { mealId, data: payload } });
    saveStore(store);
    return { success: true };
  }
  const response = await api.patch(`/meals/${mealId}`, payload);
  return response.data;
}

export async function addEntry(meal_id: number, fdc_id: number, quantity_g: number) {
  if (!isOnline()) {
    const store = loadStore();
    const day = (Object.values(store.days) as DayFull[]).find((d) =>
      d.meals.some((m) => m.id === meal_id)
    );
    if (day) {
      const meal = day.meals.find((m) => m.id === meal_id);
      if (!meal) return null;
      const id = nextTempId();
      const entry: EntryType = {
        id,
        description: "",
        quantity_g,
        kcal: 0,
        protein: 0,
        carb: 0,
        fat: 0,
        sort_order: meal.entries.length,
        fdc_id,
      };
      meal.entries.push(entry);
      cacheDay(day.date, day);
      enqueue({ kind: "addEntry", payload: { meal_id, fdc_id, quantity_g, tempId: id } });
      return { id };
    }
    return null;
  }
  const response = await api.post("/entries", { meal_id, fdc_id, quantity_g });
  return response.data;
}

export async function updateEntry(entryId: number, newGrams: number) {
  if (!isOnline()) {
    const store = loadStore();
    for (const day of Object.values(store.days) as DayFull[]) {
      for (const meal of day.meals) {
        const entry = meal.entries.find((e) => e.id === entryId);
        if (entry) entry.quantity_g = newGrams;
      }
    }
    enqueue({ kind: "updateEntry", payload: { entryId, newGrams } });
    saveStore(store);
    return { success: true };
  }
  const response = await api.patch(`/entries/${entryId}`, { quantity_g: newGrams });
  return response.data;
}

export async function moveEntry(entryId: number, newOrder: number) {
  if (!isOnline()) {
    const store = loadStore();
    for (const day of Object.values(store.days) as DayFull[]) {
      for (const meal of day.meals) {
        const entry = meal.entries.find((e) => e.id === entryId);
        if (entry) entry.sort_order = newOrder;
      }
    }
    enqueue({ kind: "moveEntry", payload: { entryId, newOrder } });
    saveStore(store);
    return { success: true };
  }
  const response = await api.patch(`/entries/${entryId}`, { sort_order: newOrder });
  return response.data;
}

export async function deleteEntry(entryId: number) {
  if (!isOnline()) {
    const store = loadStore();
    for (const day of Object.values(store.days) as DayFull[]) {
      for (const meal of day.meals) {
        const idx = meal.entries.findIndex((e) => e.id === entryId);
        if (idx >= 0) meal.entries.splice(idx, 1);
      }
    }
    enqueue({ kind: "deleteEntry", payload: { entryId } });
    saveStore(store);
    return { success: true };
  }
  const response = await api.delete(`/entries/${entryId}`);
  return response.data;
}

export async function getPresets() {
  const response = await api.get("/presets");
  return response.data.items;
}

export async function createPresetFromMeal(name: string, date: string, meal_name: string) {
  const response = await api.post("/presets/from_meal", { name, date, meal_name });
  return response.data;
}

export async function applyPreset(presetId: number, date: string, meal_name: string, multiplier: number) {
  const response = await api.post(`/presets/${presetId}/apply`, { date, meal_name, multiplier });
  return response.data;
}

export async function deletePreset(presetId: number) {
  const response = await api.delete(`/presets/${presetId}`);
  return response.data;
}

export async function exportCSV(start: string, end: string) {
  return api.get("/export", { params: { start, end }, responseType: "blob" });
}

export async function copyMealTo(
  sourceMealId: number,
  payload: CopyMealPayload
) {
  const response = await api.post(`/meals/${sourceMealId}/copy_to`, payload);
  return response.data;
}

export async function getHistory(startDate: string, endDate: string): Promise<HistoryDay[]> {
  const params = {
    start_date: startDate,
    end_date: endDate,
  };
  const response = await api.get("/history", { params });
  return response.data;
}

export async function getWeight(date: string) {
  if (!isOnline()) {
    const w = getCachedWeight(date);
    return w !== undefined ? { weight: w } : null;
  }
  try {
    const response = await api.get(`/weight/${date}`);
    if (response.data?.weight !== undefined) cacheWeight(date, response.data.weight);
    return response.data;
  } catch {
    return null;
  }
}

export async function setWeight(date: string, weight: number) {
  if (!isOnline()) {
    cacheWeight(date, weight);
    enqueue({ kind: "setWeight", payload: { date, weight } });
    return { weight };
  }
  const response = await api.put(`/weight/${date}`, { weight });
  return response.data;
}
