import { useState, useEffect } from "react";
import { useStore } from "../store";

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
        <div className="lg:col-span-1">
            <div className="sticky top-6 card">
                <div className="card-header"><h2 className="font-semibold text-lg dark:text-gray-200">Today's Totals</h2></div>
                <div className="card-body">
                    {/* --- KEY CHANGES HERE --- */}
                    {/* Changed from grid to flex for better responsive scaling */}
                    <div className="flex justify-between items-stretch gap-2">

                        {/* kcal */}
                        <div className="flex-1 bg-indigo-50 dark:bg-indigo-900/50 p-3 rounded-lg text-center transition-shadow hover:shadow-md">
                            <div className="text-sm text-indigo-800 dark:text-indigo-200">kcal</div>
                            <b className="text-lg font-bold text-indigo-900 dark:text-indigo-100">{(totals?.kcal ?? 0).toFixed(0)}</b>
                            {goals.kcal > 0 && (
                                <>
                                    <div className="mt-1 text-xs text-indigo-700 dark:text-indigo-300">{(totals?.kcal ?? 0).toFixed(0)} / {goals.kcal}</div>
                                    <div className="w-full bg-indigo-200 rounded h-2 mt-1">
                                        <div className="h-2 rounded bg-indigo-500" style={{ width: `${Math.min(100, ((totals?.kcal ?? 0) / goals.kcal) * 100)}%` }}></div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* fat */}
                        <div className="flex-1 bg-yellow-50 dark:bg-yellow-900/50 p-3 rounded-lg text-center transition-shadow hover:shadow-md">
                            <div className="text-sm text-yellow-800 dark:text-yellow-200">Fat</div>
                            <b className="text-lg font-bold text-yellow-900 dark:text-yellow-100">{(totals?.fat ?? 0).toFixed(1)}g</b>
                            {goals.fat > 0 && (
                                <>
                                    <div className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">{(totals?.fat ?? 0).toFixed(1)} / {goals.fat}g</div>
                                    <div className="w-full bg-yellow-200 rounded h-2 mt-1">
                                        <div className="h-2 rounded bg-yellow-500" style={{ width: `${Math.min(100, ((totals?.fat ?? 0) / goals.fat) * 100)}%` }}></div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* carb */}
                        <div className="flex-1 bg-red-50 dark:bg-red-900/50 p-3 rounded-lg text-center transition-shadow hover:shadow-md">
                            <div className="text-sm text-red-800 dark:text-red-200">Carb</div>
                            <b className="text-lg font-bold text-red-900 dark:text-red-100">{(totals?.carb ?? 0).toFixed(1)}g</b>
                            {goals.carb > 0 && (
                                <>
                                    <div className="mt-1 text-xs text-red-700 dark:text-red-300">{(totals?.carb ?? 0).toFixed(1)} / {goals.carb}g</div>
                                    <div className="w-full bg-red-200 rounded h-2 mt-1">
                                        <div className="h-2 rounded bg-red-500" style={{ width: `${Math.min(100, ((totals?.carb ?? 0) / goals.carb) * 100)}%` }}></div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* protein */}
                        <div className="flex-1 bg-green-50 dark:bg-green-900/50 p-3 rounded-lg text-center transition-shadow hover:shadow-md">
                            <div className="text-sm text-green-800 dark:text-green-200">Protein</div>
                            <b className="text-lg font-bold text-green-900 dark:text-green-100">{(totals?.protein ?? 0).toFixed(1)}g</b>
                            {goals.protein > 0 && (
                                <>
                                    <div className="mt-1 text-xs text-green-700 dark:text-green-300">{(totals?.protein ?? 0).toFixed(1)} / {goals.protein}g</div>
                                    <div className="w-full bg-green-200 rounded h-2 mt-1">
                                        <div className="h-2 rounded bg-green-500" style={{ width: `${Math.min(100, ((totals?.protein ?? 0) / goals.protein) * 100)}%` }}></div>
                                    </div>
                                </>
                            )}
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