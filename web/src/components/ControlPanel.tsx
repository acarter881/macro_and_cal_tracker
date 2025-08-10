import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from 'react-hot-toast';
import { useStore } from "../store";
import * as api from "../api";
import { DATA_TYPE_OPTIONS } from "../types";
import type { DataTypeOpt, LabelUnit, SimpleFood } from "../types";

function toSimpleFood(f: any): SimpleFood {
  return {
    fdcId: f.fdc_id ?? f.fdcId, description: f.description ?? "",
    brandOwner: f.brand_owner ?? f.brandOwner ?? undefined,
    dataType: f.data_type ?? f.dataType ?? undefined,
  };
}

type CustomFoodFormData = {
    description: string; brand_owner: string;
    kcal_per_100g: number | ''; protein_g_per_100g: number | ''; carb_g_per_100g: number | ''; fat_g_per_100g: number | '';
    labelKcal: number | ''; labelP: number | ''; labelC: number | ''; labelF: number | ''; servAmt: number | '';
    servUnit: LabelUnit; density: number | '';
};

export function ControlPanel() {
  const { date, mealName, allMyFoods, presets, setAllMyFoods, addFood, refreshPresets, applyPreset, goals, setGoals } = useStore();
  const currentMeal = useStore(state => state.day?.meals.find(m => m.name === state.mealName));

  const [isAddingFood, setIsAddingFood] = useState(false);
  const [isCreatingFood, setIsCreatingFood] = useState(false);
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  type GoalInputState = { fat: string; carb: string; protein: string; kcal?: string };
  const [goalInput, setGoalInput] = useState<GoalInputState>({ fat: "", carb: "", protein: "" });

  const { register, handleSubmit, formState: { errors, isValid }, watch, setValue, reset } = useForm<CustomFoodFormData>({
      mode: 'onChange',
      defaultValues: {
          density: 1, servUnit: 'g', description: '', brand_owner: '',
          kcal_per_100g: '', protein_g_per_100g: '', carb_g_per_100g: '', fat_g_per_100g: '',
          labelKcal: '', labelP: '', labelC: '', labelF: '', servAmt: ''
      }
  });

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SimpleFood[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [grams, setGrams] = useState<number>(100);
  const [typeFilter, setTypeFilter] = useState<DataTypeOpt>("Foundation");
  const [unbrandedFirst, setUnbrandedFirst] = useState<boolean>(true);
  const [searching, setSearching] = useState(false);
  const [useLabel, setUseLabel] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [exportStart, setExportStart] = useState<string>(new Date().toISOString().slice(0, 10));
  const [exportEnd, setExportEnd] = useState<string>(new Date().toISOString().slice(0, 10));
  const invalidRange = !exportStart || !exportEnd || exportStart > exportEnd;

  type TabKey = 'search' | 'custom' | 'presets' | 'goals' | 'export';
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'search', label: 'Search' },
    { key: 'custom', label: 'Custom Food' },
    { key: 'presets', label: 'Presets' },
    { key: 'goals', label: 'Goals' },
    { key: 'export', label: 'Export' },
  ];
  const [tab, setTab] = useState<TabKey>('search');

  const myFoodsFiltered = useMemo(() => {
    if (!query.trim()) return allMyFoods;
    return allMyFoods.filter(f =>
      f.description.toLowerCase().includes(query.toLowerCase()) ||
      f.brandOwner?.toLowerCase().includes(query.toLowerCase())
    );
  }, [query, allMyFoods]);

  function sortResults(list: SimpleFood[], unbranded: boolean) {
    const wt = (t?: string) => {
      if (t === "Foundation") return 0; if (t === "SR Legacy") return 1;
      if (t && t.startsWith("Survey")) return 2; if (t === "Branded") return 3; return 4;
    };
    const copy = [...list];
    copy.sort((a, b) => {
      if (unbranded) {
        const aa = a.brandOwner ? 1 : 0; const bb = b.brandOwner ? 1 : 0;
        if (aa !== bb) return aa - bb;
      }
      return wt(a.dataType) - wt(b.dataType);
    });
    return copy;
  }

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
  
  async function doSearch() {
    if (!query.trim() || query.trim().length < 2) { setResults([]); return; }
    try {
      setSearching(true);
      const r = await api.searchFoods(query, typeFilter);
      setResults(sortResults(r, unbrandedFirst));
    } finally { setSearching(false); }
  }

  useEffect(() => {
    const handler = setTimeout(() => { doSearch(); }, 350);
    return () => clearTimeout(handler);
  }, [query, typeFilter, unbrandedFirst]);


  async function handleAddSelectedFood() {
    if (!selected) return;
    setIsAddingFood(true);
    await addFood(selected, grams);
    setIsAddingFood(false);
  }

  async function handleDeleteCustomFood(foodId: number) {
    if (!confirm("Delete this custom food?")) return;
    try {
        await api.deleteCustomFood(foodId);
        setAllMyFoods(allMyFoods.filter(food => food.fdcId !== foodId));
        toast.success('Custom food deleted.');
    } catch (e: any) {
        toast.error(e?.response?.data?.detail || "Could not delete food.");
    }
  }

  const onCreateCustomFood = async (data: CustomFoodFormData) => {
    setIsCreatingFood(true);
    try {
      const payload = { ...data, kcal_per_100g: Number(data.kcal_per_100g) || 0, protein_g_per_100g: Number(data.protein_g_per_100g) || 0, carb_g_per_100g: Number(data.carb_g_per_100g) || 0, fat_g_per_100g: Number(data.fat_g_per_100g) || 0 };
      const created = await api.createCustomFood(payload);
      setAllMyFoods([toSimpleFood(created), ...allMyFoods]);
      reset();
      toast.success('Custom food created!');
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Failed to create food.");
    } finally {
      setIsCreatingFood(false);
    }
  };
  
  async function handleSavePreset() {
    if (!newPresetName.trim() || !currentMeal) return;
    setIsSavingPreset(true);
    try {
        await api.createPresetFromMeal(newPresetName.trim(), date, currentMeal.name);
        setNewPresetName("");
        await refreshPresets();
        toast.success('Preset saved!');
    } catch (e:any) {
        toast.error(e?.response?.data?.detail || "Failed to save preset.");
    } finally {
        setIsSavingPreset(false);
    }
  }
  
  async function handleExport() {
      setIsExporting(true);
      try {
        await api.exportCSV(exportStart, exportEnd);
      } catch (err: any) { 
        toast.error("Export failed. Please try again.");
      } finally {
        setIsExporting(false);
      }
  }
  
  function toGrams(amount: number, unit: LabelUnit, dens: number) {
    switch (unit) {
      case 'g': return amount; case 'ml': return amount * dens;
      case 'oz': return amount * 28.3495; case 'fl oz': return amount * 29.5735 * dens;
      case 'cup': return amount * 240 * dens; case 'tbsp': return amount * 15 * dens;
      case 'tsp': return amount * 5 * dens; default: return NaN;
    }
  }

  const watchedConverterFields = watch(["labelKcal", "labelP", "labelC", "labelF", "servAmt", "servUnit", "density"]);
  const servUnit = watch("servUnit");

  const labelPer100 = useMemo(() => {
    const [labelKcal, labelP, labelC, labelF, servAmt, servUnit, density] = watchedConverterFields;
    const [_k, _p, _c, _f, _amt, _dens] = [labelKcal, labelP, labelC, labelF, servAmt, density].map(v => v === '' ? NaN : Number(v));
    if ([_k, _p, _c, _f, _amt].some(isNaN) || !_amt || _amt <= 0) return null;
    const grams = toGrams(Number(_amt), servUnit, Number(_dens || 1));
    if (!grams || isNaN(grams)) return null;
    const factor = 100 / grams;
    return { kcal: _k * factor, protein: _p * factor, carb: _c * factor, fat: _f * factor };
  }, [watchedConverterFields]);

  function applyConverterValues() {
      if (!labelPer100) return;
      setValue("kcal_per_100g", parseFloat(labelPer100.kcal.toFixed(2)), { shouldValidate: true });
      setValue("protein_g_per_100g", parseFloat(labelPer100.protein.toFixed(2)), { shouldValidate: true });
      setValue("carb_g_per_100g", parseFloat(labelPer100.carb.toFixed(2)), { shouldValidate: true });
      setValue("fat_g_per_100g", parseFloat(labelPer100.fat.toFixed(2)), { shouldValidate: true });
  }

  return (
    <div className="lg:col-span-1">
      <div className="card">
        <div className="card-header p-0">
          <div className="flex">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 px-3 py-2 text-sm font-medium border-b-2 ${
                  tab === t.key
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="card-body space-y-4">
          {tab === 'search' && (
            <>
              <input className="form-input" placeholder="Search foods…" value={query} onChange={e => setQuery(e.target.value)} />
              <div className="flex items-center gap-2">
                <select
                  className="form-input"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as DataTypeOpt)}
                  title="Filter results by USDA data type"
                >
                  {DATA_TYPE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <label
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap"
                  title="Sort results to show unbranded foods before branded ones"
                >
                  <input type="checkbox" className="rounded text-indigo-600 focus:ring-indigo-500" checked={unbrandedFirst} onChange={(e) => setUnbrandedFirst(e.target.checked)} />
                  Unbranded first
                </label>
              </div>
              {allMyFoods.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-1 text-gray-600 dark:text-gray-400">My Foods</h4>
                  <ul className="border rounded-md divide-y dark:border-gray-600 dark:divide-gray-600 max-h-40 overflow-auto">
                    {myFoodsFiltered.map((f) => (
                      <li key={f.fdcId} className={`p-2 flex justify-between items-center cursor-pointer ${selected === f.fdcId ? 'bg-indigo-100 dark:bg-indigo-900' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`} onClick={() => setSelected(f.fdcId)}>
                        <div className="font-medium truncate text-sm">{f.description}</div>
                        <button className="btn btn-ghost btn-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50" onClick={(e) => { e.stopPropagation(); handleDeleteCustomFood(f.fdcId); }}>🗑️</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <h4 className="font-semibold text-sm mb-1 text-gray-600 dark:text-gray-400">USDA Results</h4>
                <ul className="border rounded-md divide-y dark:border-gray-600 dark:divide-gray-600 h-[250px] overflow-auto">
                  {searching ? (<li className="p-2 text-gray-500">Searching...</li>) :
                    results.map(r => (
                      <li key={r.fdcId} className={`p-2 cursor-pointer ${selected === r.fdcId ? 'bg-indigo-100 dark:bg-indigo-900' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`} onClick={() => setSelected(r.fdcId)}>
                        <div className="font-medium text-sm">{r.description}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{r.brandOwner || r.dataType}</div>
                      </li>
                    ))}
                </ul>
              </div>
              <div className="flex items-center gap-2">
                <input className="form-input w-24" type="number" min={1} step={1} value={grams} onChange={e => setGrams(parseFloat(e.target.value))} />
                <span>grams</span>
                <button className="btn btn-primary w-full" onClick={handleAddSelectedFood} disabled={!selected || isAddingFood}>
                  {isAddingFood ? 'Adding…' : `Add to ${mealName}`}
                </button>
              </div>
            </>
          )}
          {tab === 'custom' && (
            <form onSubmit={handleSubmit(onCreateCustomFood)} className="space-y-4">
              <div className="border-b pb-4 dark:border-gray-600">
                <button type="button" className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline" onClick={() => setUseLabel(v => !v)}>
                  {useLabel ? '⏷ Hide Converter' : '⏵ Convert from a nutrition label'}
                </button>
                {useLabel && (
                  <div className="mt-2 p-3 border rounded-md bg-gray-50 dark:bg-gray-700/50 dark:border-gray-600 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <input className="form-input" type="number" step="0.01" placeholder="kcal / serv" {...register('labelKcal', { valueAsNumber: true })} />
                      <input className="form-input" type="number" step="0.01" placeholder="protein g" {...register('labelP', { valueAsNumber: true })} />
                      <input className="form-input" type="number" step="0.01" placeholder="fat g" {...register('labelF', { valueAsNumber: true })} />
                      <input className="form-input" type="number" step="0.01" placeholder="carb g" {...register('labelC', { valueAsNumber: true })} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm">per</span>
                      <input className="form-input w-24" type="number" min={0} step="0.01" placeholder="Serv size" {...register('servAmt', { valueAsNumber: true })} />
                      <select className="form-input flex-1" {...register('servUnit')}>
                        <option value="g">g</option><option value="ml">ml</option><option value="oz">oz</option><option value="fl oz">fl oz</option><option value="cup">cup</option><option value="tbsp">tbsp</option><option value="tsp">tsp</option>
                      </select>
                    </div>
                    {servUnit !== 'g' && <input className="form-input" type="number" min={0.01} step={0.01} placeholder={`Density (g/ml)`} {...register('density', { valueAsNumber: true })} />}
                    {labelPer100 && (
                      <div className="flex flex-wrap items-center gap-3">
                        <button className="btn btn-secondary btn-sm" type="button" onClick={applyConverterValues}>
                          Apply ↓
                        </button>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          <b>Per 100g:</b> {labelPer100.kcal.toFixed(0)}kcal, {labelPer100.fat.toFixed(1)}F, {labelPer100.carb.toFixed(1)}C, {labelPer100.protein.toFixed(1)}P
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-sm dark:text-gray-300">Create Food (values per 100g)</h4>
                <div>
                  <input className="form-input" placeholder="Description (e.g., Pop-Tarts)" {...register('description', { required: 'Description is required' })} />
                  {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}
                </div>
                <input className="form-input" placeholder="Brand / store (optional)" {...register('brand_owner')} />
                <div className="grid grid-cols-2 gap-2">
                  <input className="form-input" type="number" step="0.01" placeholder="kcal" {...register('kcal_per_100g', { required: true, valueAsNumber: true, min: 0 })} />
                  <input className="form-input" type="number" step="0.01" placeholder="protein g" {...register('protein_g_per_100g', { required: true, valueAsNumber: true, min: 0 })} />
                  <input className="form-input" type="number" step="0.01" placeholder="fat g" {...register('fat_g_per_100g', { required: true, valueAsNumber: true, min: 0 })} />
                  <input className="form-input" type="number" step="0.01" placeholder="carb g" {...register('carb_g_per_100g', { required: true, valueAsNumber: true, min: 0 })} />
                </div>
                <div className="flex justify-end pt-2">
                  <button type="submit" className="btn btn-primary" disabled={isCreatingFood || !isValid}>
                    {isCreatingFood ? 'Creating...' : 'Create Food'}
                  </button>
                </div>
              </div>
            </form>
          )}
          {tab === 'presets' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <input className="form-input" placeholder="Save current meal as..." value={newPresetName} onChange={(e) => setNewPresetName(e.target.value)} />
                <button className="btn btn-secondary w-full" onClick={handleSavePreset} disabled={isSavingPreset || !currentMeal?.entries?.length || !newPresetName.trim()}>
                  {isSavingPreset ? 'Saving...' : 'Save Preset'}
                </button>
              </div>
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50"><tr><th className="text-left p-2">Name</th><th className="p-2 text-right">Actions</th></tr></thead>
                  <tbody>
                    {presets.map((p) => (
                      <tr key={p.id} className="border-t dark:border-gray-600">
                        <td className="p-2">{p.name} ({p.item_count})</td>
                        <td className="p-2 text-right">
                          <div className="flex gap-1 justify-end">
                            <button className="btn btn-ghost btn-sm" onClick={() => applyPreset(p.id)}>Apply</button>
                            <button className="btn btn-ghost btn-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50" onClick={async () => {
                              if (!confirm(`Delete preset \"${p.name}\"?`)) return;
                              await api.deletePreset(p.id);
                              await refreshPresets();
                            }}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {tab === 'goals' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input className="form-input" type="number" step="0.1" placeholder="Fat g" value={goalInput.fat} onChange={e=>setGoalInput({ ...goalInput, fat: e.target.value })} />
                <input className="form-input" type="number" step="0.1" placeholder="Carb g" value={goalInput.carb} onChange={e=>setGoalInput({ ...goalInput, carb: e.target.value })} />
                <input className="form-input" type="number" step="0.1" placeholder="Protein g" value={goalInput.protein} onChange={e=>setGoalInput({ ...goalInput, protein: e.target.value })} />
              </div>
              <button className="btn btn-secondary w-full" onClick={handleSaveGoals}>Save Goals</button>
            </div>
          )}
          {tab === 'export' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2"><label className="text-sm">From:</label><input className="form-input" type="date" value={exportStart} onChange={e=>setExportStart(e.target.value)} /></div>
              <div className="flex items-center gap-2"><label className="text-sm">To: &nbsp;&nbsp;&nbsp;</label><input className="form-input" type="date" value={exportEnd} onChange={e=>setExportEnd(e.target.value)} /></div>
              <button disabled={invalidRange || isExporting} className="btn btn-secondary w-full" onClick={handleExport}>
                {isExporting ? 'Downloading...' : 'Download CSV'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
