import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Mock the Zustand store used by QuickAdd
const mockStore: any = {};
vi.mock('../../store', () => ({
  useStore: (selector: any) => selector(mockStore),
}));

import { QuickAdd } from '../QuickAdd';

describe('QuickAdd', () => {
  beforeEach(() => {
    mockStore.favorites = [];
    mockStore.addFood = vi.fn();
    mockStore.mealName = 'Breakfast';
  });

  afterEach(() => {
    cleanup();
  });

  test('renders nothing when no favorites', () => {
    const { container } = render(<QuickAdd />);
    expect(container).toBeEmptyDOMElement();
  });

  test('renders favorites and handles clicks', () => {
    mockStore.favorites = [
      { fdcId: 1, description: 'Apple', defaultGrams: 150 },
    ];
    mockStore.mealName = 'Lunch';
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('175');
    render(<QuickAdd />);
    const btn = screen.getByRole('button', { name: /apple/i });
    fireEvent.click(btn);
    expect(promptSpy).toHaveBeenCalledWith(
      'Add to Lunch: How many grams of Apple?',
      '150'
    );
    expect(mockStore.addFood).toHaveBeenCalledWith(1, 175);
    promptSpy.mockRestore();
  });

  test('uses custom unit in prompt', () => {
    mockStore.favorites = [
      { fdcId: 3, description: 'Fish Oil', unit_name: 'softgel', defaultGrams: 1 },
    ];
    mockStore.mealName = 'Dinner';
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('2');
    render(<QuickAdd />);
    fireEvent.click(screen.getByRole('button', { name: /fish oil/i }));
    expect(promptSpy).toHaveBeenCalledWith(
      'Add to Dinner: How many softgel of Fish Oil?',
      '1'
    );
    expect(mockStore.addFood).toHaveBeenCalledWith(3, 2);
    promptSpy.mockRestore();
  });

  test('still triggers addFood when offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    mockStore.favorites = [
      { fdcId: 2, description: 'Pear', defaultGrams: 100 },
    ];
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('120');
    render(<QuickAdd />);
    fireEvent.click(screen.getByRole('button', { name: /pear/i }));
    expect(mockStore.addFood).toHaveBeenCalledWith(2, 120);
    promptSpy.mockRestore();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });
});
