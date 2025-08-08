import { useState, useEffect } from "react";
import { useStore } from "../store";

export function Summary() {
    const totals = useStore(state => state.day?.totals);
    const weight = useStore(state => state.weight);
    const saveWeight = useStore(state => state.saveWeight);
    const [input, setInput] = useState("");

    useEffect(() => {
        setInput(weight != null ? weight.toString() : "");
    }, [weight]);

    return (
        <div className="lg:col-span-1">
            <div className="sticky top-6 card">
                <div className="card-header"><h2 className="font-semibold text-lg dark:text-gray-200">Today's Totals</h2></div>
                <div className="card-body">
                    {/* --- KEY CHANGES HERE --- */}
                    {/* Changed from grid to flex for better responsive scaling */}
                    <div className="flex justify-between items-stretch gap-2">
                        
                        {/* flex-1 allows each card to take up equal space */}
                        <div className="flex-1 bg-indigo-50 dark:bg-indigo-900/50 p-3 rounded-lg text-center transition-shadow hover:shadow-md">
                            <div className="text-sm text-indigo-800 dark:text-indigo-200">kcal</div>
                            {/* Reduced font size slightly to prevent wrapping */}
                            <b className="text-lg font-bold text-indigo-900 dark:text-indigo-100">{totals?.kcal?.toFixed(0) || '0'}</b>
                        </div>

                        <div className="flex-1 bg-yellow-50 dark:bg-yellow-900/50 p-3 rounded-lg text-center transition-shadow hover:shadow-md">
                            <div className="text-sm text-yellow-800 dark:text-yellow-200">Fat</div>
                            <b className="text-lg font-bold text-yellow-900 dark:text-yellow-100">{totals?.fat?.toFixed(1) || '0.0'}g</b>
                        </div>

                        <div className="flex-1 bg-red-50 dark:bg-red-900/50 p-3 rounded-lg text-center transition-shadow hover:shadow-md">
                            <div className="text-sm text-red-800 dark:text-red-200">Carb</div>
                            <b className="text-lg font-bold text-red-900 dark:text-red-100">{totals?.carb?.toFixed(1) || '0.0'}g</b>
                        </div>
                        
                        <div className="flex-1 bg-green-50 dark:bg-green-900/50 p-3 rounded-lg text-center transition-shadow hover:shadow-md">
                            <div className="text-sm text-green-800 dark:text-green-200">Protein</div>
                            <b className="text-lg font-bold text-green-900 dark:text-green-100">{totals?.protein?.toFixed(1) || '0.0'}g</b>
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