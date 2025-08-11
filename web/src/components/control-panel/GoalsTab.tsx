import { useEffect, useState } from "react";
import toast from 'react-hot-toast';
import { useStore } from "../../store";

export function GoalsTab() {
  const { goals, setGoals } = useStore();
  type GoalInputState = { fat: string; carb: string; protein: string; kcal?: string };
  const [goalInput, setGoalInput] = useState<GoalInputState>({ fat: "", carb: "", protein: "" });

  useEffect(() => {
    setGoalInput({
      fat: goals.fat ? goals.fat.toString() : "",
      carb: goals.carb ? goals.carb.toString() : "",
      protein: goals.protein ? goals.protein.toString() : "",
    });
  }, [goals]);

  const handleSaveGoals = () => {
    const g = {
      fat: parseFloat(goalInput.fat) || 0,
      carb: parseFloat(goalInput.carb) || 0,
      protein: parseFloat(goalInput.protein) || 0,
      kcal: 0,
    };
    const computedKcal = g.protein * 4 + g.carb * 4 + g.fat * 9;
    const inputKcal = goalInput.kcal ? parseFloat(goalInput.kcal) : NaN;
    if (!isNaN(inputKcal) && Math.abs(inputKcal - computedKcal) > 5) {
      toast.error('Calories do not match macros.');
      return;
    }
    g.kcal = computedKcal;
    setGoals(g);
    toast.success('Goals saved!');
  };

  const ids = { fat: "goal-fat", carb: "goal-carb", protein: "goal-protein" } as const;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col">
          <label htmlFor={ids.fat} className="sr-only">Fat grams</label>
          <input id={ids.fat} className="form-input" type="number" step="0.1" placeholder="Fat g" value={goalInput.fat} onChange={e=>setGoalInput({ ...goalInput, fat: e.target.value })} />
        </div>
        <div className="flex flex-col">
          <label htmlFor={ids.carb} className="sr-only">Carb grams</label>
          <input id={ids.carb} className="form-input" type="number" step="0.1" placeholder="Carb g" value={goalInput.carb} onChange={e=>setGoalInput({ ...goalInput, carb: e.target.value })} />
        </div>
        <div className="flex flex-col">
          <label htmlFor={ids.protein} className="sr-only">Protein grams</label>
          <input id={ids.protein} className="form-input" type="number" step="0.1" placeholder="Protein g" value={goalInput.protein} onChange={e=>setGoalInput({ ...goalInput, protein: e.target.value })} />
        </div>
      </div>
      <button className="btn btn-secondary w-full" onClick={handleSaveGoals}>Save Goals</button>
    </div>
  );
}
