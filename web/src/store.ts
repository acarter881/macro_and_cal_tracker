import { create } from "zustand";
import toast from "react-hot-toast";
import * as mealsApi from "./api/meals";
import * as foodsApi from "./api/foods";
import { syncQueue } from "./api/offline";
import type {
  DayFull,
  Preset,
  SimpleFood,
  MealType,
  Goals,
  EntryType,
  CopyMealPayload,
} from "./types";
import { loadJSON, saveJSON } from "./utils/storage";

type Theme = "light" | "dark";

interface AppState {
  copiedMealId: number | null;
  copiedEntry: EntryType | null;
  theme: Theme;
  date: string;
  mealName: string;
  day: DayFull | null;
  // busy: boolean; // <-- REMOVED
  allMyFoods: SimpleFood[];
  favorites: SimpleFood[];
  presets: Preset[];
  weight: number | null;
  water: number | null;
  goals: Goals;
  showWater: boolean;
  /** Information about the most recently deleted entry for undo. */
  lastDeleted: { mealId: number; entry: EntryType; index: number } | null;
  /** Information about the last undone deletion for redo. */
  redoDeleted: { mealId: number; entry: EntryType; index: number } | null;
}

interface AppActions {
  copyMeal: (mealId: number) => void;
  pasteMeal: () => Promise<void>;
  copyEntry: (entry: EntryType) => void;
  pasteEntry: () => Promise<void>;
  toggleTheme: () => void;
  focusSearch: () => void;
  init: () => Promise<void>;
  setDate: (newDate: string) => void;
  setMealName: (newName: string) => void;
  fetchDay: () => Promise<void>;
  addFood: (foodId: number, grams: number) => Promise<void>;
  updateEntry: (entryId: number, grams: number) => Promise<void>;
  moveEntry: (entryId: number, newOrder: number) => Promise<void>;
  deleteEntry: (entryId: number) => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  addMeal: () => Promise<void>;
  deleteMeal: (mealId: number) => Promise<void>;
  renameMeal: (mealId: number, newName: string) => Promise<void>;
  moveMeal: (mealId: number, newOrder: number) => Promise<void>;
  refreshPresets: () => Promise<void>;
  applyPreset: (presetId: number) => Promise<void>;
  setAllMyFoods: (foods: SimpleFood[]) => void;
  toggleFavorite: (food: SimpleFood) => void;
  saveWeight: (w: number) => Promise<void>;
  saveWater: (ml: number) => Promise<void>;
  incrementWater: (amount: number) => Promise<void>;
  setGoals: (g: Goals) => void;
  toggleShowWater: () => void;
  syncOffline: () => Promise<void>;
}

const getInitialTheme = (): Theme => {
  if (typeof window !== "undefined") {
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme === "dark" || storedTheme === "light") return storedTheme;
    if (window.matchMedia("(prefers-color-scheme: dark)").matches)
      return "dark";
  }
  return "light";
};

// --- Daily Goals helpers -------------------------------------------------
const EMPTY_GOALS: Goals = { kcal: 0, protein: 0, fat: 0, carb: 0, water: 0 };

// Return default goals saved in localStorage, or empty goals if none set
const loadDefaultGoals = (): Goals => ({
  ...EMPTY_GOALS,
  ...loadJSON<Partial<Goals>>("defaultGoals", {}),
});

// Return full mapping of date -> goals from localStorage
const loadGoalsMap = (): Record<string, Goals> =>
  loadJSON<Record<string, Goals>>("goalsByDate", {});

// Load goals for specific date, falling back to the most recently saved goals
const getGoalsForDate = (d: string): Goals => {
  const all = loadGoalsMap();
  if (all[d]) return { ...EMPTY_GOALS, ...all[d] };
  const past = Object.keys(all)
    .filter((date) => date <= d)
    .sort();
  const latest = past[past.length - 1];
  if (latest) return { ...EMPTY_GOALS, ...all[latest] };
  return loadDefaultGoals();
};

// --- Favorites helpers ---------------------------------------------------
const loadFavorites = (): SimpleFood[] =>
  loadJSON<SimpleFood[]>("favorites", []);

// --- Day mutation helpers -------------------------------------------------
type MacroTotals = { kcal: number; protein: number; fat: number; carb: number };

/**
 * Apply a macro delta immutably.
 *
 * Zustand subscribers relying on object reference checks (the default
 * behaviour) won't be notified if we mutate the existing totals object in
 * place. This function returns a new object with the delta applied so that any
 * part of the state tree referencing it receives a new reference and
 * components such as the `Summary` card re-render when entries are removed or
 * added.
 */
const applyDelta = (t: MacroTotals, d: MacroTotals): MacroTotals => ({
  kcal: +(t.kcal + d.kcal).toFixed(2),
  protein: +(t.protein + d.protein).toFixed(2),
  fat: +(t.fat + d.fat).toFixed(2),
  carb: +(t.carb + d.carb).toFixed(2),
});

interface MacroFood {
  kcal_per_100g?: number;
  protein_g_per_100g?: number;
  carb_g_per_100g?: number;
  fat_g_per_100g?: number;
  unit_name?: string;
  kcal_per_unit?: number;
  protein_g_per_unit?: number;
  carb_g_per_unit?: number;
  fat_g_per_unit?: number;
}

const macrosFromFood = (food: MacroFood, amount: number): MacroTotals => {
  if (food.unit_name) {
    const f = amount;
    return {
      kcal: +((food.kcal_per_unit || 0) * f).toFixed(2),
      protein: +((food.protein_g_per_unit || 0) * f).toFixed(2),
      fat: +((food.fat_g_per_unit || 0) * f).toFixed(2),
      carb: +((food.carb_g_per_unit || 0) * f).toFixed(2),
    };
  }
  const f = amount / 100;
  return {
    kcal: +((food.kcal_per_100g || 0) * f).toFixed(2),
    protein: +((food.protein_g_per_100g || 0) * f).toFixed(2),
    fat: +((food.fat_g_per_100g || 0) * f).toFixed(2),
    carb: +((food.carb_g_per_100g || 0) * f).toFixed(2),
  };
};

const scaledMacros = (e: EntryType, grams: number): MacroTotals => {
  const factor = grams / e.quantity_g;
  return {
    kcal: +(e.kcal * factor).toFixed(2),
    protein: +(e.protein * factor).toFixed(2),
    fat: +(e.fat * factor).toFixed(2),
    carb: +(e.carb * factor).toFixed(2),
  };
};

const initialDate = new Date().toISOString().slice(0, 10);

export const useStore = create<AppState & AppActions>((set, get) => ({
  copiedMealId: null,
  copiedEntry: null,
  theme: getInitialTheme(),
  date: initialDate,
  mealName: "Meal 1",
  day: null,
  allMyFoods: [],
  favorites: loadFavorites(),
  presets: [],
  weight: null,
  water: null,
  goals: getGoalsForDate(initialDate),
  showWater: loadJSON<boolean>("showWater", true),
  lastDeleted: null,
  redoDeleted: null,

  copyMeal: (mealId: number) => {
    set({ copiedMealId: mealId });
    toast.success("Meal copied!");
  },

  pasteMeal: async () => {
    const sourceMealId = get().copiedMealId;
    if (!sourceMealId) return;
    const payload: CopyMealPayload = {
      date: get().date,
      meal_name: get().mealName,
    };
    const promise = mealsApi.copyMealTo(sourceMealId, payload);
    toast.promise(promise, {
      loading: "Pasting meal...",
      success: "Meal pasted successfully!",
      error: "Failed to paste meal.",
    });
    await promise;
    set({ copiedMealId: null });
    await get().fetchDay();
  },

  copyEntry: (entry: EntryType) => {
    set({ copiedEntry: entry });
    toast.success("Entry copied!");
  },

  pasteEntry: async () => {
    const entry = get().copiedEntry;
    const state = get();
    if (!entry || !state.day) return;
    let meal = state.day.meals.find((m) => m.name === state.mealName);
    if (!meal) {
      const newMeal = await mealsApi.createMeal(state.date);
      meal = {
        ...newMeal,
        entries: [],
        subtotal: { kcal: 0, protein: 0, fat: 0, carb: 0 },
      };
      state.day.meals.push(meal);
    }
    const promise = mealsApi.addEntry(meal.id, entry.fdc_id!, entry.quantity_g);
    toast.promise(promise, {
      loading: "Pasting entry...",
      success: "Entry pasted successfully!",
      error: "Failed to paste entry.",
    });
    const res = await promise;
    const sortOrder =
      res?.sort_order ??
      (meal.entries[meal.entries.length - 1]?.sort_order ?? 0) + 1;
    const newEntry: EntryType = {
      ...entry,
      id: res?.id ?? entry.id,
      sort_order: sortOrder,
    };
    meal.entries.push(newEntry);
    meal.entries.sort((a, b) => a.sort_order - b.sort_order);
    meal.subtotal = applyDelta(meal.subtotal, {
      kcal: entry.kcal,
      protein: entry.protein,
      fat: entry.fat,
      carb: entry.carb,
    });
    state.day.totals = applyDelta(state.day.totals, {
      kcal: entry.kcal,
      protein: entry.protein,
      fat: entry.fat,
      carb: entry.carb,
    });
    set({ day: { ...state.day }, copiedEntry: null });
  },

  toggleTheme: () => {
    const newTheme = get().theme === "light" ? "dark" : "light";
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(newTheme);
    localStorage.setItem("theme", newTheme);
    set({ theme: newTheme });
  },

  focusSearch: () => {
    if (typeof document === "undefined") return;
    const el = document.getElementById(
      "search-query",
    ) as HTMLInputElement | null;
    if (el) {
      el.focus();
      el.select();
    }
  },

  init: async () => {
    const initialTheme = get().theme;
    document.documentElement.classList.add(initialTheme);
    await get().syncOffline();
    await get().fetchDay();
    await get().refreshPresets();
    const foods = await foodsApi.searchMyFoods();
    set({ allMyFoods: foods });
  },

  setDate: (newDate) => {
    set({ date: newDate, goals: getGoalsForDate(newDate) });
    get().fetchDay();
  },
  setMealName: (newName) => set({ mealName: newName }),
  setAllMyFoods: (foods) => set({ allMyFoods: foods }),

  toggleFavorite: (food) => {
    set((state) => {
      const exists = state.favorites.some((f) => f.fdcId === food.fdcId);
      const favorites = exists
        ? state.favorites.filter((f) => f.fdcId !== food.fdcId)
        : [...state.favorites, food];
      if (typeof window !== "undefined") {
        saveJSON("favorites", favorites);
      }
      return { favorites };
    });
  },

  saveWeight: async (w) => {
    try {
      await mealsApi.setWeight(get().date, w);
      set({ weight: w });
      toast.success("Weight saved!");
    } catch {
      toast.error("Failed to save weight.");
    }
  },

  saveWater: async (ml) => {
    try {
      await mealsApi.setWater(get().date, ml);
      set({ water: ml });
      toast.success("Water saved!");
    } catch {
      toast.error("Failed to save water.");
    }
  },

  incrementWater: async (amount) => {
    const current = get().water ?? 0;
    await get().saveWater(current + amount);
  },

  fetchDay: async () => {
    try {
      let d = await mealsApi.getDayFull(get().date);
      if (d.meals.length === 0) {
        for (let i = 0; i < 4; i++) {
          await mealsApi.createMeal(get().date);
        }
        d = await mealsApi.getDayFull(get().date);
      }
      const [w, water] = await Promise.all([
        mealsApi.getWeight(get().date),
        mealsApi.getWater(get().date),
      ]);
      set({
        day: d,
        weight: w?.weight ?? null,
        water: water?.milliliters ?? null,
      });
      const mealExists = d.meals.some(
        (m: MealType) => m.name === get().mealName,
      );
      if (!mealExists) set({ mealName: d.meals[0]?.name || "Meal 1" });
    } catch (error) {
      toast.error(
        "Failed to fetch day. Please check your connection and try again.",
      );
      const state = get();
      if (!state.day) {
        const placeholder: DayFull = {
          date: state.date,
          meals: [],
          totals: { kcal: 0, protein: 0, fat: 0, carb: 0 },
        };
        set({ day: placeholder });
      }
    }
  },

  addFood: async (foodId, grams) => {
    try {
      const state = get();
      let day = state.day;
      if (!day) return;
      let meal = day.meals.find((m) => m.name === state.mealName);
      if (!meal) {
        const newMeal = await mealsApi.createMeal(state.date);
        meal = {
          ...newMeal,
          entries: [],
          subtotal: { kcal: 0, protein: 0, fat: 0, carb: 0 },
        };
        day.meals.push(meal);
      }
      const food = await foodsApi.getFood(foodId);
      const entryRes = await mealsApi.addEntry(meal.id, foodId, grams);
      const macros = macrosFromFood(food, grams);
      const newEntry: EntryType = {
        id: entryRes.id,
        description: food.description,
        quantity_g: grams,
        kcal: macros.kcal,
        protein: macros.protein,
        carb: macros.carb,
        fat: macros.fat,
        sort_order: entryRes.sort_order,
        fdc_id: foodId,
        unit_name: food.unit_name,
      };
      meal.entries.push(newEntry);
      meal.entries.sort((a, b) => a.sort_order - b.sort_order);
      meal.subtotal = applyDelta(meal.subtotal, macros);
      day.totals = applyDelta(day.totals, macros);
      set({ day });
    } catch (e) {
      toast.error("Failed to add food entry.");
    }
  },

  addMeal: async () => {
    const newMeal = await mealsApi.createMeal(get().date);
    await get().fetchDay();
    set({ mealName: newMeal.name });
  },

  deleteMeal: async (mealId) => {
    await mealsApi.deleteMeal(mealId);
    await get().fetchDay();
  },

  renameMeal: async (mealId, newName) => {
    await mealsApi.updateMeal(mealId, { name: newName });
    set((state) => {
      const day = state.day;
      if (!day) return {};
      const meal = day.meals.find((m) => m.id === mealId);
      const wasCurrent = meal ? state.mealName === meal.name : false;
      if (meal) meal.name = newName;
      return { day, mealName: wasCurrent ? newName : state.mealName };
    });
  },

  moveMeal: async (mealId, newOrder) => {
    await mealsApi.updateMeal(mealId, { sort_order: newOrder });
    await get().fetchDay();
  },

  updateEntry: async (entryId, grams) => {
    await mealsApi.updateEntry(entryId, grams);
    set((state) => {
      const day = state.day;
      if (!day) return {};
      for (const meal of day.meals) {
        const entry = meal.entries.find((e) => e.id === entryId);
        if (entry) {
          const newTotals = scaledMacros(entry, grams);
          const delta = {
            kcal: newTotals.kcal - entry.kcal,
            protein: newTotals.protein - entry.protein,
            fat: newTotals.fat - entry.fat,
            carb: newTotals.carb - entry.carb,
          };
          entry.quantity_g = grams;
          entry.kcal = newTotals.kcal;
          entry.protein = newTotals.protein;
          entry.fat = newTotals.fat;
          entry.carb = newTotals.carb;
          meal.subtotal = applyDelta(meal.subtotal, delta);
          day.totals = applyDelta(day.totals, delta);
          break;
        }
      }
      return { day };
    });
  },

  moveEntry: async (entryId, newOrder) => {
    await mealsApi.moveEntry(entryId, newOrder);
    set((state) => {
      const day = state.day;
      if (!day) return {};
      for (const meal of day.meals) {
        const idx = meal.entries.findIndex((e) => e.id === entryId);
        if (idx >= 0) {
          const [entry] = meal.entries.splice(idx, 1);
          meal.entries.splice(Math.max(0, newOrder - 1), 0, entry);
          meal.entries.forEach((e, i) => {
            e.sort_order = i + 1;
          });
          break;
        }
      }
      return { day };
    });
  },

  deleteEntry: async (entryId) => {
    await mealsApi.deleteEntry(entryId);
    set((state) => {
      const day = state.day;
      if (!day) return {};
      let deleted: { mealId: number; entry: EntryType; index: number } | null =
        null;
      for (const meal of day.meals) {
        const idx = meal.entries.findIndex((e) => e.id === entryId);
        if (idx >= 0) {
          const entry = meal.entries[idx];
          meal.entries.splice(idx, 1);
          meal.entries.forEach((e, i) => {
            e.sort_order = i + 1;
          });
          const delta = {
            kcal: -entry.kcal,
            protein: -entry.protein,
            fat: -entry.fat,
            carb: -entry.carb,
          };
          meal.subtotal = applyDelta(meal.subtotal, delta);
          day.totals = applyDelta(day.totals, delta);
          deleted = { mealId: meal.id, entry, index: idx };
          break;
        }
      }
      return { day, lastDeleted: deleted, redoDeleted: null };
    });
  },

  undo: async () => {
    const info = get().lastDeleted;
    if (!info) return;
    const { mealId, entry, index } = info;
    const res = await mealsApi.addEntry(
      mealId,
      entry.fdc_id || 0,
      entry.quantity_g,
    );
    set((state) => {
      const day = state.day;
      if (!day) return {};
      const meal = day.meals.find((m) => m.id === mealId);
      if (!meal) return {};
      const newEntry = { ...entry, id: res.id, sort_order: res.sort_order };
      meal.entries.splice(index, 0, newEntry);
      meal.entries.forEach((e, i) => {
        e.sort_order = i + 1;
      });
      const delta = {
        kcal: entry.kcal,
        protein: entry.protein,
        fat: entry.fat,
        carb: entry.carb,
      };
      meal.subtotal = applyDelta(meal.subtotal, delta);
      day.totals = applyDelta(day.totals, delta);
      return {
        day,
        lastDeleted: null,
        redoDeleted: { mealId, entry: newEntry, index },
      };
    });
  },

  redo: async () => {
    const info = get().redoDeleted;
    if (!info) return;
    const { mealId, entry, index } = info;
    await mealsApi.deleteEntry(entry.id);
    set((state) => {
      const day = state.day;
      if (!day) return {};
      const meal = day.meals.find((m) => m.id === mealId);
      if (!meal) return {};
      const idx = meal.entries.findIndex((e) => e.id === entry.id);
      if (idx >= 0) {
        meal.entries.splice(idx, 1);
        meal.entries.forEach((e, i) => {
          e.sort_order = i + 1;
        });
        const delta = {
          kcal: -entry.kcal,
          protein: -entry.protein,
          fat: -entry.fat,
          carb: -entry.carb,
        };
        meal.subtotal = applyDelta(meal.subtotal, delta);
        day.totals = applyDelta(day.totals, delta);
      }
      return { day, lastDeleted: { mealId, entry, index }, redoDeleted: null };
    });
  },

  refreshPresets: async () => {
    const presets = await mealsApi.getPresets();
    set({ presets });
  },

  applyPreset: async (presetId) => {
    try {
      await mealsApi.applyPreset(presetId, get().date, get().mealName, 1);
      await get().fetchDay();
      toast.success("Preset applied!");
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } };
      toast.error(err?.response?.data?.detail || "Failed to apply preset.");
    }
  },

  setGoals: (g) => {
    if (typeof window !== "undefined") {
      const all = loadGoalsMap();
      all[get().date] = g;
      saveJSON("goalsByDate", all);
      saveJSON("defaultGoals", g);
    }
    set({ goals: g });
  },

  toggleShowWater: () => {
    set((state) => {
      const value = !state.showWater;
      saveJSON("showWater", value);
      return { showWater: value };
    });
  },

  syncOffline: async () => {
    await syncQueue();
    await get().fetchDay();
    const foods = await foodsApi.searchMyFoods();
    set({ allMyFoods: foods });
    const [w, water] = await Promise.all([
      mealsApi.getWeight(get().date),
      mealsApi.getWater(get().date),
    ]);
    set({ weight: w?.weight ?? null, water: water?.milliliters ?? null });
  },
}));

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    useStore.getState().syncOffline();
  });
}
