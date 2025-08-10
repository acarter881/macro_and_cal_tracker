import { useState, useEffect } from "react";
import { useStore } from "../store";
import RadialProgress from "./RadialProgress";

export function Summary() {
    const totals = useStore(state => state.day?.totals);
    const weight = useStore(state => state.weight);
    const goals = useStore(state => state.goals);
    const saveWeight = useStore(state => state.saveWeight);
    const [input, setInput] = useState("");

    useEffect(() => {
        setInput(weight != null ? weight.toString() : "");
    }, [weight]);

    return (
        <div>
            <div className="sticky top-6 card">
                <div className="card-header"><h2 className="font-semibold text-lg dark:text-gray-200">Today's Totals</h2></div>
                <div className="card-body">
                    <div className="flex justify-between items-stretch gap-2">
                        {/* kcal */}
                        <div className="flex-1 bg-indigo-50 dark:bg-indigo-900/50 p-3 rounded-lg text-center transition-shadow hover:shadow-md">
                            <div className="text-sm text-indigo-800 dark:text-indigo-200 mb-2">kcal</div>
                            <RadialProgress value={totals?.kcal ?? 0} goal={goals.kcal} color="text-indigo-500" decimals={0} />
                        </div>

                        {/* fat */}
                        <div className="flex-1 bg-yellow-50 dark:bg-yellow-900/50 p-3 rounded-lg text-center transition-shadow hover:shadow-md">
                            <div className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">Fat</div>
                            <RadialProgress value={totals?.fat ?? 0} goal={goals.fat} color="text-yellow-500" decimals={1} unit="g" />
                        </div>

                        {/* carb */}
                        <div className="flex-1 bg-red-50 dark:bg-red-900/50 p-3 rounded-lg text-center transition-shadow hover:shadow-md">
                            <div className="text-sm text-red-800 dark:text-red-200 mb-2">Carb</div>
                            <RadialProgress value={totals?.carb ?? 0} goal={goals.carb} color="text-red-500" decimals={1} unit="g" />
                        </div>

                        {/* protein */}
                        <div className="flex-1 bg-green-50 dark:bg-green-900/50 p-3 rounded-lg text-center transition-shadow hover:shadow-md">
                            <div className="text-sm text-green-800 dark:text-green-200 mb-2">Protein</div>
                            <RadialProgress value={totals?.protein ?? 0} goal={goals.protein} color="text-green-500" decimals={1} unit="g" />
                        </div>
                    </div>
                    <div className="mt-6">
                        <label className="block mb-1 text-sm text-gray-700 dark:text-gray-300">Body Weight (lb)</label>
                        <div className="flex gap-2">
                            <input className="form-input flex-1" value={input} onChange={e => setInput(e.target.value)} />
                            <button className="btn btn-primary" onClick={() => { const v = parseFloat(input); if(!isNaN(v)) saveWeight(v); }}>Save</button>
                        </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-4 text-center">Calories for custom foods use the label; USDA items use 4/4/9.</div>
                </div>
            </div>
        </div>
    );
}
