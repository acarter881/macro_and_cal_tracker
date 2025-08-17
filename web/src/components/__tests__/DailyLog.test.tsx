import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Mock the Zustand store used by DailyLog
const mockStore: any = {};
vi.mock("../../store", () => ({
  useStore: (selector?: any) => (selector ? selector(mockStore) : mockStore),
}));

import { DailyLog } from "../DailyLog";

describe("DailyLog", () => {
  beforeEach(() => {
    mockStore.day = { date: "2024-01-01", meals: [] };
    mockStore.mealName = "Meal 1";
    mockStore.setDate = vi.fn();
    mockStore.setMealName = vi.fn();
    mockStore.addMeal = vi.fn().mockResolvedValue(undefined);
    mockStore.updateEntry = vi.fn();
    mockStore.moveEntry = vi.fn();
    mockStore.deleteEntry = vi.fn();
    mockStore.deleteMeal = vi.fn();
    mockStore.renameMeal = vi.fn();
    mockStore.moveMeal = vi.fn();
    mockStore.copiedMealId = null;
    mockStore.copyMeal = vi.fn();
    mockStore.pasteMeal = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  test("renders date picker and add meal button", () => {
    render(<DailyLog />);
    expect(screen.getByLabelText(/Date:/i)).toHaveValue("2024-01-01");
    expect(screen.getByRole("button", { name: /\+ Meal/ })).toBeInTheDocument();
  });

  test("allows changing date and adding a meal", () => {
    render(<DailyLog />);
    fireEvent.click(screen.getByRole("button", { name: "Next day" }));
    expect(mockStore.setDate).toHaveBeenCalledWith("2024-01-02");
    const addBtn = screen.getByRole("button", { name: /\+ Meal/ });
    fireEvent.click(addBtn);
    expect(mockStore.addMeal).toHaveBeenCalled();
  });

  test("add meal works when offline", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
    });
    render(<DailyLog />);
    const addBtn = screen.getAllByRole("button", { name: /\+ Meal/ })[0];
    fireEvent.click(addBtn);
    expect(mockStore.addMeal).toHaveBeenCalled();
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
    });
  });
});
