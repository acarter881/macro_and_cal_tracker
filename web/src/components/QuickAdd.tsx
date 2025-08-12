import { useStore } from "../store";
import { Button } from "./ui/Button";

export function QuickAdd() {
  const addFood = useStore(s => s.addFood);
  // Exclude custom foods from the quick‑add list to avoid duplicating
  // items already shown in the "My Foods" section.
  const foods = useStore(s => s.allMyFoods)
    .filter(f => f.dataType !== "Custom")
    .slice(0, 5);
  if (!foods.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {foods.map(f => (
        <Button
          key={f.fdcId}
          className="btn-secondary btn-sm"
          onClick={() => addFood(f.fdcId, f.defaultGrams ?? 100)}
        >
          {f.description}
        </Button>
      ))}
    </div>
  );
}
