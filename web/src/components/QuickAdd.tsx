import { useStore } from "../store";
import type { SimpleFood } from "../types";
import { Button } from "./ui/Button";

export function QuickAdd() {
  const addFood = useStore(s => s.addFood);
  const favorites = useStore(s => s.favorites);
  const mealName = useStore(s => s.mealName);
  if (!favorites.length) return null;

  function handleClick(f: SimpleFood) {
    const unit = f.unit_name || "grams";
    const defaultAmount = f.defaultGrams ?? (f.unit_name ? 1 : 100);
    const input = window.prompt(
      `Add to ${mealName}: How many ${unit} of ${f.description}?`,
      String(defaultAmount)
    );
    if (!input) return;
    const qty = parseFloat(input);
    if (!isNaN(qty) && qty > 0) {
      addFood(f.fdcId, qty);
    }
  }

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {favorites.map(f => (
        <Button
          key={f.fdcId}
          className="btn-secondary btn-sm"
          onClick={() => handleClick(f)}
        >
          {f.description}
        </Button>
      ))}
    </div>
  );
}
