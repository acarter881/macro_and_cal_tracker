import { useState, useEffect } from "react";
import { useStore } from "../store";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";

const ML_PER_OUNCE = 29.5735;

export function WaterTracker() {
  const water = useStore((s) => s.water);
  const saveWater = useStore((s) => s.saveWater);
  const incrementWater = useStore((s) => s.incrementWater);
  const [ml, setMl] = useState("");
  const [oz, setOz] = useState("");

  useEffect(() => {
    if (water != null) {
      setMl(water.toString());
      setOz((water / ML_PER_OUNCE).toFixed(1));
    } else {
      setMl("");
      setOz("");
    }
  }, [water]);

  const handleMlChange = (value: string) => {
    setMl(value);
    const num = parseFloat(value);
    if (!isNaN(num)) {
      setOz((num / ML_PER_OUNCE).toFixed(1));
    } else {
      setOz("");
    }
  };

  const handleOzChange = (value: string) => {
    setOz(value);
    const num = parseFloat(value);
    if (!isNaN(num)) {
      setMl((num * ML_PER_OUNCE).toFixed(0));
    } else {
      setMl("");
    }
  };

  const handleSave = () => {
    const num = parseFloat(ml);
    if (!isNaN(num)) {
      saveWater(num);
    }
  };

  const addWater = (amount: number) => {
    const current = water ?? 0;
    const total = current + amount;
    setMl(total.toString());
    setOz((total / ML_PER_OUNCE).toFixed(1));
    incrementWater(amount);
  };

  return (
    <div className="mt-6">
      <label className="block mb-1 text-sm text-text dark:text-text-light">
        Water
      </label>
      <div className="flex gap-2 mb-2">
        <Input
          id="water-ml"
          type="number"
          className="flex-1"
          value={ml}
          onChange={(e) => handleMlChange(e.target.value)}
          placeholder="ml"
        />
        <Input
          id="water-oz"
          type="number"
          className="flex-1"
          value={oz}
          onChange={(e) => handleOzChange(e.target.value)}
          placeholder="oz"
        />
      </div>
      <div className="flex gap-2 mb-2">
        <Button
          type="button"
          className="btn-secondary w-full"
          onClick={() => addWater(250)}
        >
          +250 ml
        </Button>
        <Button
          type="button"
          className="btn-secondary w-full"
          onClick={() => addWater(8 * ML_PER_OUNCE)}
        >
          +8 oz
        </Button>
      </div>
      <Button
        className="btn-primary w-full"
        aria-label="Save water"
        onClick={handleSave}
      >
        Save
      </Button>
    </div>
  );
}

export default WaterTracker;

