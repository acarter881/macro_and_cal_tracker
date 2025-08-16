import axios from "axios";
import toast from "react-hot-toast";
import type {
  DayFull,
  HistoryDay,
  SimpleFood,
  MealType,
  EntryType,
  CustomFoodPayload,
  CopyMealPayload,
  OfflineOp,
  OfflineStore,
} from "./types";
import { loadJSON, saveJSON } from "./utils/storage";

// --- Offline cache helpers -------------------------------------------------
const isOnline = () =>
  typeof navigator === "undefined" ? true : navigator.onLine;

const OFFLINE_KEY = "offline-cache";
const MAX_QUEUE_LENGTH = 100;

const defaultStore: OfflineStore = {
  days: {},
  foods: [],
  weights: {},
  queue: [],
  nextId: -1,
};

function loadStore(): OfflineStore {
  return loadJSON<OfflineStore>(OFFLINE_KEY, { ...defaultStore });
}

function saveStore(s: OfflineStore) {
  saveJSON(OFFLINE_KEY, s);
}

export function getOfflineQueueSize(): number {
  const s = loadStore();
  return s.queue.length;
}

function emitQueueSize() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("offline-queue-changed", {
        detail: getOfflineQueueSize(),
      })
    );
  }
}

function nextTempId(): number {
  const s = loadStore();
  s.nextId -= 1;
  saveStore(s);
  return s.nextId;
}

function enqueue(op: OfflineOp) {
  const s = loadStore();
  s.queue.push(op);
  if (s.queue.length > MAX_QUEUE_LENGTH) {
    s.queue.splice(0, s.queue.length - MAX_QUEUE_LENGTH);
  }
  saveStore(s);
  emitQueueSize();
}

function cacheDay(date: string, day: DayFull) {
  const s = loadStore();
  s.days[date] = day;
  saveStore(s);
}

function getCachedDay(date: string): DayFull | null {
  const s = loadStore();
  return s.days[date] || null;
}

function cacheFoods(foods: SimpleFood[]) {
  const s = loadStore();
  s.foods = foods;
  saveStore(s);
}

function getCachedFoods(): SimpleFood[] {
  const s = loadStore();
  return s.foods || [];
}

function cacheWeight(date: string, weight: number) {
  const s = loadStore();
  s.weights[date] = weight;
  saveStore(s);
}

function getCachedWeight(date: string): number | undefined {
  const s = loadStore();
  return s.weights[date];
}

// Determine the API base URL.  In production the frontend is typically served
// from the same origin as the API so ``window.location.origin`` works.  During
// local development the frontend runs on the Vite dev server (usually port
// 5173) while the API runs on port 8000.  Previously we defaulted to the
// current origin which caused the app to attempt API calls against the dev
// server, resulting in a blank white screen on load.  To avoid this we fall
// back to ``http://localhost:8000`` whenever the origin appears to be the Vite
// dev server or is otherwise unavailable.
const origin = typeof window !== "undefined" ? window.location.origin : "";
const inferredBase =
  import.meta.env.VITE_API_BASE_URL ||
  (origin && !origin.includes("5173") ? origin : "http://localhost:8000");

const api = axios.create({
  baseURL: `${inferredBase}/api`,
});

const configAuthToken = import.meta.env.VITE_CONFIG_AUTH_TOKEN;
const configHeaders = configAuthToken
  ? { "X-Config-Token": configAuthToken }
  : undefined;

class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

// --- Food & Search ---
export async function searchFoods(query: string, dataType: string) {
  try {
    const response = await api.get("/foods/search", {
      params: { q: query, dataType },
    });
    return response.data.results;
  } catch (err) {
    console.error("Failed to search foods:", err);
    if (axios.isAxiosError(err) && err.response?.status === 503) {
      const detail = err.response.data?.detail;
      toast.error(
        typeof detail === "string"
          ? detail
          : "USDA search service unavailable. Please try again later."
      );
    } else {
      toast.error("Food search failed.");
    }
    return [];
  }
}

export async function getFood(fdcId: number) {
  try {
    const response = await api.get(`/foods/${fdcId}`);
    return response.data;
  } catch (err) {
    console.error("Failed to fetch food:", err);
    toast.error("Failed to fetch food.");
    throw new ApiError("Failed to fetch food");
  }
}

// --- Day, Meals, and Entries ---
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

// --- Presets ---
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

// --- Custom Foods ---
export async function createCustomFood(payload: CustomFoodPayload) {
  const response = await api.post("/custom_foods", payload);
  return response.data;
}

export async function searchMyFoods() {
    if (!isOnline()) {
      return getCachedFoods();
    }
    const response = await api.get("/my_foods");
    cacheFoods(response.data);
    return response.data;
}

export async function deleteCustomFood(foodId: number) {
    const response = await api.delete(`/custom_foods/${foodId}`);
    return response.data;
}

// --- Export ---
export async function exportCSV(start: string, end: string) {
  return api.get("/export", { params: { start, end }, responseType: 'blob' });
}

// --- Meal Copying ---
export async function copyMealTo(
  sourceMealId: number,
  payload: CopyMealPayload
) {
  const response = await api.post(`/meals/${sourceMealId}/copy_to`, payload);
  return response.data;
}

// --- History ---
export async function getHistory(startDate: string, endDate: string): Promise<HistoryDay[]> {
  const params = {
    start_date: startDate,
    end_date: endDate,
  };
  const response = await api.get("/history", { params });
  return response.data;
}

// --- Body Weight ---
export async function getWeight(date: string) {
  if (!isOnline()) {
    const w = getCachedWeight(date);
    return w !== undefined ? { weight: w } : null;
  }
  try {
    const response = await api.get(`/weight/${date}`);
    if (response.data?.weight !== undefined) cacheWeight(date, response.data.weight);
    return response.data;
  } catch (err) {
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

// --- Configuration ---
export async function getUsdaKey(): Promise<string | null> {
  const response = await api.get("/config/usda-key", { headers: configHeaders });
  return response.data.key || null;
}

export async function updateUsdaKey(key: string) {
  const response = await api.post(
    "/config/usda-key",
    { key },
    { headers: configHeaders }
  );
  return response.data;
}

// --- Sync queued offline mutations ----------------------------------------
export async function syncQueue() {
  if (!isOnline()) return;
  const store = loadStore();
  const idMap: Record<number, number> = {};
  while (store.queue.length) {
    const item = store.queue.shift()!;
    switch (item.kind) {
      case "createMeal": {
        try {
          const res = await api.post("/meals", { date: item.payload.date });
          const newId = res.data.id;
          idMap[item.payload.tempId] = newId;
          const day = store.days[item.payload.date];
          const meal = day?.meals.find((m) => m.id === item.payload.tempId);
          if (meal) meal.id = newId;
        } catch {
          store.queue.unshift(item);
          saveStore(store);
          emitQueueSize();
          return;
        }
        break;
      }
      case "deleteMeal": {
        try {
          const mealId = idMap[item.payload.mealId] ?? item.payload.mealId;
          await api.delete(`/meals/${mealId}`);
        } catch {
          store.queue.unshift(item);
          saveStore(store);
          emitQueueSize();
          return;
        }
        break;
      }
      case "updateMeal": {
        try {
          const mealId = idMap[item.payload.mealId] ?? item.payload.mealId;
          await api.patch(`/meals/${mealId}`, item.payload.data);
        } catch {
          store.queue.unshift(item);
          saveStore(store);
          emitQueueSize();
          return;
        }
        break;
      }
      case "addEntry": {
        try {
          const mealId = idMap[item.payload.meal_id] ?? item.payload.meal_id;
          const res = await api.post("/entries", {
            meal_id: mealId,
            fdc_id: item.payload.fdc_id,
            quantity_g: item.payload.quantity_g,
          });
          const newId = res.data.id;
          idMap[item.payload.tempId] = newId;
          for (const day of Object.values(store.days) as DayFull[]) {
            for (const meal of day.meals) {
              const entry = meal.entries.find((e) => e.id === item.payload.tempId);
              if (entry) entry.id = newId;
            }
          }
        } catch {
          store.queue.unshift(item);
          saveStore(store);
          emitQueueSize();
          return;
        }
        break;
      }
      case "updateEntry": {
        try {
          const entryId = idMap[item.payload.entryId] ?? item.payload.entryId;
          await api.patch(`/entries/${entryId}`, { quantity_g: item.payload.newGrams });
        } catch {
          store.queue.unshift(item);
          saveStore(store);
          emitQueueSize();
          return;
        }
        break;
      }
      case "moveEntry": {
        try {
          const entryId = idMap[item.payload.entryId] ?? item.payload.entryId;
          await api.patch(`/entries/${entryId}`, { sort_order: item.payload.newOrder });
        } catch {
          store.queue.unshift(item);
          saveStore(store);
          emitQueueSize();
          return;
        }
        break;
      }
      case "deleteEntry": {
        try {
          const entryId = idMap[item.payload.entryId] ?? item.payload.entryId;
          await api.delete(`/entries/${entryId}`);
        } catch {
          store.queue.unshift(item);
          saveStore(store);
          emitQueueSize();
          return;
        }
        break;
      }
      case "setWeight": {
        try {
          await api.put(`/weight/${item.payload.date}`, { weight: item.payload.weight });
        } catch {
          store.queue.unshift(item);
          saveStore(store);
          emitQueueSize();
          return;
        }
        break;
      }
    }
  }
  saveStore(store);
  emitQueueSize();
}
