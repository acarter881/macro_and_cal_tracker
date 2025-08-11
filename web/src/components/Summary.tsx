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
                <div className="card-header"><h2 className="font-semibold text-lg dark:text-text-light">Today's Totals</h2></div>
                <div className="card-body">
                    <div className="flex justify-between items-stretch gap-2">
                        {/* kcal */}
                        <div className="flex-1 bg-brand-primary/10 dark:bg-brand-primary/30 p-3 rounded-lg text-center transition-shadow hover:shadow-md">
                            <div className="text-sm text-brand-primary dark:text-brand-primary mb-2">kcal</div>
                            <RadialProgress value={totals?.kcal ?? 0} goal={goals.kcal} color="text-brand-primary" decimals={0} />
                        </div>

                        {/* fat */}
                        <div className="flex-1 bg-brand-warning/10 dark:bg-brand-warning/30 p-3 rounded-lg text-center transition-shadow hover:shadow-md">
                            <div className="text-sm text-brand-warning dark:text-brand-warning mb-2">Fat</div>
                            <RadialProgress value={totals?.fat ?? 0} goal={goals.fat} color="text-brand-warning" decimals={1} unit="g" />
                        </div>

                        {/* carb */}
                        <div className="flex-1 bg-brand-danger/10 dark:bg-brand-danger/30 p-3 rounded-lg text-center transition-shadow hover:shadow-md">
                            <div className="text-sm text-brand-danger dark:text-brand-danger mb-2">Carb</div>
                            <RadialProgress value={totals?.carb ?? 0} goal={goals.carb} color="text-brand-danger" decimals={1} unit="g" />
                        </div>

                        {/* protein */}
                        <div className="flex-1 bg-brand-success/10 dark:bg-brand-success/30 p-3 rounded-lg text-center transition-shadow hover:shadow-md">
                            <div className="text-sm text-brand-success dark:text-brand-success mb-2">Protein</div>
                            <RadialProgress value={totals?.protein ?? 0} goal={goals.protein} color="text-brand-success" decimals={1} unit="g" />
                        </div>
                    </div>
                    <div className="mt-6">
                        <label htmlFor="body-weight" className="block mb-1 text-sm text-text dark:text-text-light">Body Weight (lb)</label>
                        <div className="flex gap-2">
                            <input
                                id="body-weight"
                                className="form-input flex-1"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                            />
                            <button
                                className="btn btn-primary"
                                aria-label="Save weight"
                                onClick={() => { const v = parseFloat(input); if(!isNaN(v)) saveWeight(v); }}
                            >
                                Save
                            </button>
                        </div>
                    </div>
                    <div className="text-xs text-text-muted mt-4 text-center">Calories for custom foods use the label; USDA items use 4/4/9.</div>
                </div>
            </div>
        </div>
    );
}
