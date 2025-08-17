import { render, screen, cleanup } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, test, vi } from "vitest";

const mockStore: any = {};
vi.mock("../../store", () => ({
  useStore: (selector?: any) => (selector ? selector(mockStore) : mockStore),
}));

import { SearchBar } from "../SearchBar";

describe("SearchBar", () => {
  beforeEach(() => {
    mockStore.mealName = "Breakfast";
    mockStore.allMyFoods = [];
    mockStore.setAllMyFoods = vi.fn();
    mockStore.addFood = vi.fn();
    mockStore.favorites = [];
    mockStore.toggleFavorite = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  test("shows tooltip for Unbranded first", () => {
    render(<SearchBar />);
    const checkbox = screen.getByLabelText("Unbranded first");
    expect(checkbox).toHaveAttribute("title", "Show unbranded foods first");
  });
});
