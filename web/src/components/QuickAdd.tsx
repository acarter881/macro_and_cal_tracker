import { useStore } from "../store";
import { Button } from "./ui/Button";

export function QuickAdd() {
  const addFood = useStore(s => s.addFood);
  const favorites = useStore(s => s.favorites);
  if (!favorites.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {favorites.map(f => (
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
