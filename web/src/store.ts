import { create } from 'zustand';
import toast from 'react-hot-toast';
import * as api from './api';
import type { DayFull, Preset, SimpleFood, MealType, Goals, EntryType } from "./types";

type Theme = 'light' | 'dark';

interface AppState {
  copiedMealId: number | null;
  theme: Theme;
  date: string;
  mealName: string;
  day: DayFull | null;
  // busy: boolean; // <-- REMOVED
  allMyFoods: SimpleFood[];
  favorites: SimpleFood[];
  presets: Preset[];
  weight: number | null;
  goals: Goals;
}

interface AppActions {
  copyMeal: (mealId: number) => void;
  pasteMeal: () => Promise<void>;
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
  addMeal: () => Promise<void>;
  deleteMeal: (mealId: number) => Promise<void>;
  renameMeal: (mealId: number, newName: string) => Promise<void>;
  moveMeal: (mealId: number, newOrder: number) => Promise<void>;
  refreshPresets: () => Promise<void>;
  applyPreset: (presetId: number) => Promise<void>;
  setAllMyFoods: (foods: SimpleFood[]) => void;
  toggleFavorite: (food: SimpleFood) => void;
  saveWeight: (w: number) => Promise<void>;
  setGoals: (g: Goals) => void;
  syncOffline: () => Promise<void>;
}

const getInitialTheme = (): Theme => {
    if (typeof window !== 'undefined') {
        const storedTheme = localStorage.getItem('theme');
        if (storedTheme === 'dark' || storedTheme === 'light') return storedTheme;
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    }
    return 'light';
};

// --- Daily Goals helpers -------------------------------------------------
const EMPTY_GOALS: Goals = { kcal: 0, protein: 0, fat: 0, carb: 0 };

// Return default goals saved in localStorage, or empty goals if none set
const loadDefaultGoals = (): Goals => {
  if (typeof window === 'undefined') return { ...EMPTY_GOALS };
  try {
    return JSON.parse(localStorage.getItem('defaultGoals') || JSON.stringify(EMPTY_GOALS));
  } catch {
    return { ...EMPTY_GOALS };
  }
};

// Return full mapping of date -> goals from localStorage
const loadGoalsMap = (): Record<string, Goals> => {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem('goalsByDate') || '{}');
  } catch {
    return {};
  }
};

// Load goals for specific date, falling back to the most recently saved goals
const getGoalsForDate = (d: string): Goals => {
  const all = loadGoalsMap();
  if (all[d]) return all[d];
  const past = Object.keys(all).filter(date => date <= d).sort();
  const latest = past[past.length - 1];
  if (latest) return all[latest];
  return loadDefaultGoals();
};

// --- Favorites helpers ---------------------------------------------------
const loadFavorites = (): SimpleFood[] => {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem('favorites') || '[]');
  } catch {
    return [];
  }
};

// --- Day mutation helpers -------------------------------------------------
type MacroTotals = { kcal: number; protein: number; fat: number; carb: number };

const applyDelta = (t: MacroTotals, d: MacroTotals) => {
  t.kcal = +(t.kcal + d.kcal).toFixed(2);
  t.protein = +(t.protein + d.protein).toFixed(2);
  t.fat = +(t.fat + d.fat).toFixed(2);
  t.carb = +(t.carb + d.carb).toFixed(2);
};

const macrosFromFood = (food: any, grams: number): MacroTotals => {
  const f = grams / 100;
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
  theme: getInitialTheme(),
  date: initialDate,
  mealName: "Meal 1",
  day: null,
  allMyFoods: [],
  favorites: loadFavorites(),
  presets: [],
  weight: null,
  goals: getGoalsForDate(initialDate),

  copyMeal: (mealId: number) => {
    set({ copiedMealId: mealId });
    toast.success('Meal copied!');
  },

  pasteMeal: async () => {
    const sourceMealId = get().copiedMealId;
    if (!sourceMealId) return;
    const promise = api.copyMealTo(sourceMealId, get().date, get().mealName);
    toast.promise(promise, {
        loading: 'Pasting meal...',
        success: 'Meal pasted successfully!',
        error: 'Failed to paste meal.',
    });
    await promise;
    set({ copiedMealId: null });
    await get().fetchDay();
  },

  toggleTheme: () => {
    const newTheme = get().theme === 'light' ? 'dark' : 'light';
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(newTheme);
    localStorage.setItem('theme', newTheme);
    set({ theme: newTheme });
  },

  focusSearch: () => {
    if (typeof document === 'undefined') return;
    const el = document.getElementById('search-query') as HTMLInputElement | null;
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
    const foods = await api.searchMyFoods();
    set({ allMyFoods: foods });
  },

  setDate: (newDate) => { set({ date: newDate, goals: getGoalsForDate(newDate) }); get().fetchDay(); },
  setMealName: (newName) => set({ mealName: newName }),
  setAllMyFoods: (foods) => set({ allMyFoods: foods }),

  toggleFavorite: (food) => {
    set((state) => {
      const exists = state.favorites.some(f => f.fdcId === food.fdcId);
      const favorites = exists
        ? state.favorites.filter(f => f.fdcId !== food.fdcId)
        : [...state.favorites, food];
      if (typeof window !== 'undefined') {
        localStorage.setItem('favorites', JSON.stringify(favorites));
      }
      return { favorites };
    });
  },

  saveWeight: async (w) => {
    try {
      await api.setWeight(get().date, w);
      set({ weight: w });
      toast.success('Weight saved!');
    } catch {
      toast.error('Failed to save weight.');
    }
  },

  fetchDay: async () => {
    try {
      let d = await api.getDayFull(get().date);
      if (d.meals.length === 0) {
        for (let i = 0; i < 4; i++) { await api.createMeal(get().date); }
        d = await api.getDayFull(get().date);
      }
      const w = await api.getWeight(get().date);
      set({ day: d, weight: w?.weight ?? null });
      const mealExists = d.meals.some((m: MealType) => m.name === get().mealName);
      if (!mealExists) set({ mealName: d.meals[0]?.name || "Meal 1" });
    } catch (error) { console.error("Failed to fetch day:", error);
    }
  },

  addFood: async (foodId, grams) => {
    try {
      const state = get();
      let day = state.day;
      if (!day) return;
      let meal = day.meals.find(m => m.name === state.mealName);
      if (!meal) {
        const newMeal = await api.createMeal(state.date);
        meal = { ...newMeal, entries: [], subtotal: { kcal: 0, protein: 0, fat: 0, carb: 0 } };
        day.meals.push(meal);
      }
      const food = await api.getFood(foodId);
      const entryRes = await api.addEntry(meal.id, foodId, grams);
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
      };
      meal.entries.push(newEntry);
      meal.entries.sort((a, b) => a.sort_order - b.sort_order);
      applyDelta(meal.subtotal, macros);
      applyDelta(day.totals, macros);
      set({ day });
    } catch (e) {
      toast.error("Failed to add food entry.");
    }
  },

  addMeal: async () => {
    const newMeal = await api.createMeal(get().date);
    await get().fetchDay();
    set({ mealName: newMeal.name });
  },
  
  deleteMeal: async (mealId) => {
    await api.deleteMeal(mealId);
    await get().fetchDay();
  },

  renameMeal: async (mealId, newName) => {
    await api.updateMeal(mealId, { name: newName });
    set((state) => {
      const day = state.day;
      if (!day) return {};
      const meal = day.meals.find(m => m.id === mealId);
      const wasCurrent = meal ? state.mealName === meal.name : false;
      if (meal) meal.name = newName;
      return { day, mealName: wasCurrent ? newName : state.mealName };
    });
  },

  moveMeal: async (mealId, newOrder) => {
    await api.updateMeal(mealId, { sort_order: newOrder });
    await get().fetchDay();
  },

  updateEntry: async (entryId, grams) => {
    await api.updateEntry(entryId, grams);
    set((state) => {
      const day = state.day;
      if (!day) return {};
      for (const meal of day.meals) {
        const entry = meal.entries.find(e => e.id === entryId);
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
          applyDelta(meal.subtotal, delta);
          applyDelta(day.totals, delta);
          break;
        }
      }
      return { day };
    });
  },

  moveEntry: async (entryId, newOrder) => {
    await api.moveEntry(entryId, newOrder);
    set((state) => {
      const day = state.day;
      if (!day) return {};
      for (const meal of day.meals) {
        const idx = meal.entries.findIndex(e => e.id === entryId);
        if (idx >= 0) {
          const [entry] = meal.entries.splice(idx, 1);
          meal.entries.splice(Math.max(0, newOrder - 1), 0, entry);
          meal.entries.forEach((e, i) => { e.sort_order = i + 1; });
          break;
        }
      }
      return { day };
    });
  },

  deleteEntry: async (entryId) => {
    await api.deleteEntry(entryId);
    set((state) => {
      const day = state.day;
      if (!day) return {};
      for (const meal of day.meals) {
        const idx = meal.entries.findIndex(e => e.id === entryId);
        if (idx >= 0) {
          const entry = meal.entries[idx];
          meal.entries.splice(idx, 1);
          meal.entries.forEach((e, i) => { e.sort_order = i + 1; });
          const delta = { kcal: -entry.kcal, protein: -entry.protein, fat: -entry.fat, carb: -entry.carb };
          applyDelta(meal.subtotal, delta);
          applyDelta(day.totals, delta);
          break;
        }
      }
      return { day };
    });
  },
  
  refreshPresets: async () => {
    const presets = await api.getPresets();
    set({ presets });
  },

  applyPreset: async (presetId) => {
    try {
      await api.applyPreset(presetId, get().date, get().mealName, 1);
      await get().fetchDay();
      toast.success('Preset applied!');
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Failed to apply preset.");
    }
  },

  setGoals: (g) => {
    if (typeof window !== 'undefined') {
      const all = loadGoalsMap();
      all[get().date] = g;
      localStorage.setItem('goalsByDate', JSON.stringify(all));
      localStorage.setItem('defaultGoals', JSON.stringify(g));
    }
    set({ goals: g });
  },

  syncOffline: async () => {
    await api.syncQueue();
    await get().fetchDay();
    const foods = await api.searchMyFoods();
    set({ allMyFoods: foods });
    const w = await api.getWeight(get().date);
    set({ weight: w?.weight ?? null });
  }
}));

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useStore.getState().syncOffline();
  });
}
