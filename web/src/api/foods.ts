import axios from "axios";
import toast from "react-hot-toast";
import type { SimpleFood, CustomFoodPayload } from "../types";
import { api, ApiError, configHeaders } from "./client";
import { isOnline, cacheFoods, getCachedFoods } from "./offline";

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
          : "USDA search service unavailable. Please try again later.",
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

export async function archiveCustomFood(foodId: number) {
  const response = await api.patch(`/custom_foods/${foodId}`, {
    archived: true,
  });
  return response.data;
}

export async function getUsdaKey(): Promise<string | null> {
  const response = await api.get("/config/usda-key", {
    headers: configHeaders,
  });
  return response.data.key || null;
}

export async function updateUsdaKey(key: string) {
  const response = await api.post(
    "/config/usda-key",
    { key },
    { headers: configHeaders },
  );
  return response.data;
}
