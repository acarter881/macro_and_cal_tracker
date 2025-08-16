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
    mockStore.allMyFoods = [];
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
    render(<QuickAdd />);
    fireEvent.click(screen.getByRole('button', { name: /apple/i }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Add to Lunch: How many grams of Apple?');
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('150');
    fireEvent.change(input, { target: { value: '175' } });
    fireEvent.click(screen.getByRole('button', { name: /ok/i }));
    expect(mockStore.addFood).toHaveBeenCalledWith(1, 175);
  });

  test('uses custom unit in dialog', () => {
    // Simulate legacy data where the unit was stored as `unitName`
    mockStore.favorites = [
      { fdcId: 3, description: 'Fish Oil', unitName: 'softgel', defaultGrams: 1 },
    ];
    mockStore.mealName = 'Dinner';
    render(<QuickAdd />);
    fireEvent.click(screen.getByRole('button', { name: /fish oil/i }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Add to Dinner: How many softgel of Fish Oil?');
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /ok/i }));
    expect(mockStore.addFood).toHaveBeenCalledWith(3, 2);
  });

  test('falls back to allMyFoods for unit', () => {
    mockStore.allMyFoods = [
      { fdcId: 4, description: 'Fish Oil', unit_name: 'softgel' },
    ];
    mockStore.favorites = [
      { fdcId: 4, description: 'Fish Oil' },
    ];
    mockStore.mealName = 'Snack';
    render(<QuickAdd />);
    fireEvent.click(screen.getByRole('button', { name: /fish oil/i }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Add to Snack: How many softgel of Fish Oil?');
  });

  test('still triggers addFood when offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    mockStore.favorites = [
      { fdcId: 2, description: 'Pear', defaultGrams: 100 },
    ];
    render(<QuickAdd />);
    fireEvent.click(screen.getByRole('button', { name: /pear/i }));
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: /ok/i }));
    expect(mockStore.addFood).toHaveBeenCalledWith(2, 120);
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });
});
