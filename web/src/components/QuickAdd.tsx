import { useStore } from "../store";
import { Button } from "./ui/Button";

export function QuickAdd() {
  const addFood = useStore(s => s.addFood);
  const favorites = useStore(s => s.favorites);
  if (!favorites.length) return null;

  function handleClick(f: { fdcId: number; description: string; defaultGrams?: number }) {
    const defaultAmount = f.defaultGrams ?? 100;
    const input = window.prompt(
      `How many grams of ${f.description}?`,
      String(defaultAmount)
    );
    if (!input) return;
    const grams = parseFloat(input);
    if (!isNaN(grams) && grams > 0) {
      addFood(f.fdcId, grams);
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
