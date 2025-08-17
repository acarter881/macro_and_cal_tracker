import { api } from "./client";
import type {
  DayFull,
  SimpleFood,
  OfflineOp,
  OfflineStore,
} from "../types";
import { loadJSON, saveJSON } from "../utils/storage";

export const isOnline = () =>
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

export function loadStore(): OfflineStore {
  return loadJSON<OfflineStore>(OFFLINE_KEY, { ...defaultStore });
}

export function saveStore(s: OfflineStore) {
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

export function nextTempId(): number {
  const s = loadStore();
  s.nextId -= 1;
  saveStore(s);
  return s.nextId;
}

export function enqueue(op: OfflineOp) {
  const s = loadStore();
  s.queue.push(op);
  if (s.queue.length > MAX_QUEUE_LENGTH) {
    s.queue.splice(0, s.queue.length - MAX_QUEUE_LENGTH);
  }
  saveStore(s);
  emitQueueSize();
}

export function cacheDay(date: string, day: DayFull) {
  const s = loadStore();
  s.days[date] = day;
  saveStore(s);
}

export function getCachedDay(date: string): DayFull | null {
  const s = loadStore();
  return s.days[date] || null;
}

export function cacheFoods(foods: SimpleFood[]) {
  const s = loadStore();
  s.foods = foods;
  saveStore(s);
}

export function getCachedFoods(): SimpleFood[] {
  const s = loadStore();
  return s.foods || [];
}

export function cacheWeight(date: string, weight: number) {
  const s = loadStore();
  s.weights[date] = weight;
  saveStore(s);
}

export function getCachedWeight(date: string): number | undefined {
  const s = loadStore();
  return s.weights[date];
}

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
