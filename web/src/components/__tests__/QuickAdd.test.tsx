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
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('175');
    render(<QuickAdd />);
    const btn = screen.getByRole('button', { name: /apple/i });
    fireEvent.click(btn);
    expect(mockStore.addFood).toHaveBeenCalledWith(1, 175);
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
