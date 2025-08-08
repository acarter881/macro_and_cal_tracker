import { create } from 'zustand';
import toast from 'react-hot-toast';
import * as api from './api';
import type { DayFull, Preset, SimpleFood, MealType, Goals } from "./types";

type Theme = 'light' | 'dark';

interface AppState {
  copiedMealId: number | null;
  theme: Theme;
  date: string;
  mealName: string;
  day: DayFull | null;
  // busy: boolean; // <-- REMOVED
  allMyFoods: SimpleFood[];
  presets: Preset[];
  weight: number | null;
  goals: Goals;
}

interface AppActions {
  copyMeal: (mealId: number) => void;
  pasteMeal: () => Promise<void>;
  toggleTheme: () => void;
  init: () => Promise<void>;
  setDate: (newDate: string) => void;
  setMealName: (newName: string) => void;
  fetchDay: () => Promise<void>;
  addFood: (foodId: number, grams: number) => Promise<void>;
  updateEntry: (entryId: number, grams: number) => Promise<void>;
  deleteEntry: (entryId: number) => Promise<void>;
  addMeal: () => Promise<void>;
  deleteMeal: (mealId: number) => Promise<void>;
  refreshPresets: () => Promise<void>;
  applyPreset: (presetId: number) => Promise<void>;
  setAllMyFoods: (foods: SimpleFood[]) => void;
  saveWeight: (w: number) => Promise<void>;
  setGoals: (g: Goals) => void;
}

const getInitialTheme = (): Theme => {
    if (typeof window !== 'undefined') {
        const storedTheme = localStorage.getItem('theme');
        if (storedTheme === 'dark' || storedTheme === 'light') return storedTheme;
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    }
    return 'light';
};

const getInitialGoals = (): Goals => {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('goals');
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
  }
  return { kcal: 0, protein: 0, fat: 0, carb: 0 };
};

export const useStore = create<AppState & AppActions>((set, get) => ({
  copiedMealId: null,
  theme: getInitialTheme(),
  date: new Date().toISOString().slice(0, 10),
  mealName: "Meal 1",
  day: null,
  allMyFoods: [],
  presets: [],
  weight: null,
  goals: getInitialGoals(),

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

  init: async () => {
    const initialTheme = get().theme;
    document.documentElement.classList.add(initialTheme);
    await get().fetchDay();
    await get().refreshPresets();
    const foods = await api.searchMyFoods();
    set({ allMyFoods: foods });
  },

  setDate: (newDate) => { set({ date: newDate }); get().fetchDay(); },
  setMealName: (newName) => set({ mealName: newName }),
  setAllMyFoods: (foods) => set({ allMyFoods: foods }),

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
      let mealId = get().day?.meals.find(m => m.name === get().mealName)?.id;
      if (!mealId) {
        const newMeal = await api.createMeal(get().date);
        mealId = newMeal.id;
      }
      if (mealId === undefined) { throw new Error("Could not find a meal."); }
      await api.getFood(foodId);
      await api.addEntry(mealId, foodId, grams);
      await get().fetchDay();
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
  
  updateEntry: async (entryId, grams) => {
    await api.updateEntry(entryId, grams);
    await get().fetchDay();
  },
  
  deleteEntry: async (entryId) => {
    await api.deleteEntry(entryId);
    await get().fetchDay();
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
      localStorage.setItem('goals', JSON.stringify(g));
    }
    set({ goals: g });
  }
}));