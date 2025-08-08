import axios from "axios";
import type { HistoryDay } from "./types";

const api = axios.create({ baseURL: "http://localhost:8000/api" });

// --- Food & Search ---
export async function searchFoods(query: string, dataType: string) {
  const response = await api.get("/foods/search", { params: { q: query, dataType } });
  return response.data.results;
}

export async function getFood(fdcId: number) {
  const response = await api.get(`/foods/${fdcId}`);
  return response.data;
}

// --- Day, Meals, and Entries ---
export async function getDayFull(date: string) {
  const response = await api.get(`/days/${date}/full`);
  return response.data;
}

export async function createMeal(date: string) {
  const response = await api.post("/meals", { date });
  return response.data;
}

export async function deleteMeal(mealId: number) {
  const response = await api.delete(`/meals/${mealId}`);
  return response.data;
}

export async function addEntry(meal_id: number, fdc_id: number, quantity_g: number) {
  const response = await api.post("/entries", { meal_id, fdc_id, quantity_g });
  return response.data;
}

export async function updateEntry(entryId: number, newGrams: number) {
  const response = await api.patch(`/entries/${entryId}`, { quantity_g: newGrams });
  return response.data;
}

export async function deleteEntry(entryId: number) {
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
export async function createCustomFood(payload: any) {
    const response = await api.post("/custom_foods", payload);
    return response.data;
}

export async function searchMyFoods() {
    const response = await api.get("/my_foods");
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
export async function copyMealTo(sourceMealId: number, date: string, meal_name: string) {
    const response = await api.post(`/meals/${sourceMealId}/copy_to`, { date, meal_name });
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
  try {
    const response = await api.get(`/weight/${date}`);
    return response.data;
  } catch (err) {
    return null;
  }
}

export async function setWeight(date: string, weight: number) {
  const response = await api.put(`/weight/${date}`, { weight });
  return response.data;
}
