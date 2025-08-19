// web/src/types.ts (replace entire file)

// **FIXED**: Removed unused import of `getDayFull`

// Basic food object used for search results and lists
export type SimpleFood = {
  fdcId: number;
  description: string;
  brandOwner?: string;
  dataType?: string;
  defaultGrams?: number;
  unit_name?: string;
};

// --- MEAL & DAY ---
// This now includes the new sort_order field from the backend
export interface MealType {
  id: number;
  name: string;
  date: string;
  sort_order: number;
  entries: EntryType[];
  subtotal: {
    kcal: number;
    protein: number;
    fat: number;
    carb: number;
  };
}

export interface EntryType {
  id: number;
  description: string;
  quantity_g: number;
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  sort_order: number;
  /**
   * Identifier of the underlying food item.  This is needed for actions like
   * undoing a deletion where we must recreate the entry via the API.
   */
  fdc_id?: number;
  unit_name?: string;
}

// The full data structure for a day's meals and totals
export type DayFull = {
  date: string;
  meals: MealType[];
  totals: {
    kcal: number;
    protein: number;
    fat: number;
    carb: number;
  };
};

// --- CONSTANTS & OTHER TYPES ---
export const DATA_TYPE_OPTIONS = [
  "All",
  "Foundation",
  "SR Legacy",
  "Survey (FNDDS)",
  "Branded",
] as const;
export type DataTypeOpt = (typeof DATA_TYPE_OPTIONS)[number];

export type LabelUnit = "g" | "ml" | "oz" | "fl oz" | "cup" | "tbsp" | "tsp";

export type Preset = {
  id: number;
  name: string;
  item_count: number;
};

export type HistoryDay = {
  date: string;
  kcal: number;
  protein: number;
  fat: number;
  carb: number;
  weight?: number;
  water?: number;
};

// User-configurable daily macro goals
export type Goals = {
  kcal: number;
  protein: number;
  fat: number;
  carb: number;
};

export interface CustomFoodPayload {
  description: string;
  brand_owner?: string;
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

export interface CopyMealPayload {
  date: string;
  meal_name: string;
}

export type CreateMealPayload = { date: string; tempId: number };
export type DeleteMealPayload = { mealId: number };
export type UpdateMealPayload = {
  mealId: number;
  data: { name?: string; sort_order?: number };
};
export type AddEntryPayload = {
  meal_id: number;
  fdc_id: number;
  quantity_g: number;
  tempId: number;
};
export type UpdateEntryPayload = { entryId: number; newGrams: number };
export type MoveEntryPayload = { entryId: number; newOrder: number };
export type DeleteEntryPayload = { entryId: number };
export type SetWeightPayload = { date: string; weight: number };
export type SetWaterPayload = { date: string; water: number };

export type OfflineOp =
  | { kind: "createMeal"; payload: CreateMealPayload }
  | { kind: "deleteMeal"; payload: DeleteMealPayload }
  | { kind: "updateMeal"; payload: UpdateMealPayload }
  | { kind: "addEntry"; payload: AddEntryPayload }
  | { kind: "updateEntry"; payload: UpdateEntryPayload }
  | { kind: "moveEntry"; payload: MoveEntryPayload }
  | { kind: "deleteEntry"; payload: DeleteEntryPayload }
  | { kind: "setWeight"; payload: SetWeightPayload }
  | { kind: "setWater"; payload: SetWaterPayload };

export interface OfflineStore {
  days: Record<string, DayFull>;
  dayTimestamps: Record<string, number>;
  foods: SimpleFood[];
  foodsTimestamp: number;
  weights: Record<string, number>;
  weightTimestamps: Record<string, number>;
  waters: Record<string, number>;
  waterTimestamps: Record<string, number>;
  queue: OfflineOp[];
  nextId: number;
}
