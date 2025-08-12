// web/src/types.ts (replace entire file)

// **FIXED**: Removed unused import of `getDayFull`

// Basic food object used for search results and lists
export type SimpleFood = {
  fdcId: number;
  description: string;
  brandOwner?: string;
  dataType?: string;
  defaultGrams?: number;
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
export const DATA_TYPE_OPTIONS = ["All", "Foundation", "SR Legacy", "Survey (FNDDS)", "Branded"] as const;
export type DataTypeOpt = typeof DATA_TYPE_OPTIONS[number];

export type LabelUnit = 'g'|'ml'|'oz'|'fl oz'|'cup'|'tbsp'|'tsp';

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
};

// User-configurable daily macro goals
export type Goals = {
  kcal: number;
  protein: number;
  fat: number;
  carb: number;
};