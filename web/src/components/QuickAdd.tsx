import { useState } from "react";
import { useStore } from "../store";
import type { SimpleFood } from "../types";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

export function QuickAdd() {
  const addFood = useStore(s => s.addFood);
  const favorites = useStore(s => s.favorites);
  const mealName = useStore(s => s.mealName);
  const allMyFoods = useStore(s => s.allMyFoods);
  const [current, setCurrent] = useState<SimpleFood | null>(null);
  const [qty, setQty] = useState("0");
  if (!favorites.length) return null;

  function handleClick(f: SimpleFood) {
    const unit =
      f.unit_name ||
      (f as any).unitName ||
      allMyFoods.find(food => food.fdcId === f.fdcId)?.unit_name;
    const defaultAmount = f.defaultGrams ?? (unit ? 1 : 100);
    setQty(String(defaultAmount));
    setCurrent({ ...f, unit_name: unit });
  }

  function submit() {
    if (!current) return;
    const amount = parseFloat(qty);
    if (!isNaN(amount) && amount > 0) {
      addFood(current.fdcId, amount);
    }
    setCurrent(null);
  }

  return (
    <>
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
      {current && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setCurrent(null)}
        >
          <div
            className="bg-surface-light dark:bg-surface-dark rounded-md p-6 shadow-lg text-text dark:text-text-light"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <p className="mb-4">
              Add to <span className="font-semibold">{mealName}</span>: How many
              <span className="font-semibold"> {current.unit_name || "grams"}</span>
              {" "}of <span className="font-semibold">{current.description}</span>?
            </p>
            <Input
              type="number"
              value={qty}
              onChange={e => setQty(e.currentTarget.value)}
              className="w-full mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button className="btn-secondary" onClick={() => setCurrent(null)}>
                Cancel
              </Button>
              <Button className="btn-primary" onClick={submit}>
                OK
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
