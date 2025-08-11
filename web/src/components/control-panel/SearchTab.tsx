import { useEffect, useMemo, useState } from "react";
import toast from 'react-hot-toast';
import { useStore } from "../../store";
import * as api from "../../api";
import { DATA_TYPE_OPTIONS } from "../../types";
import type { DataTypeOpt, SimpleFood } from "../../types";

export function SearchTab() {
  const { mealName, allMyFoods, setAllMyFoods, addFood } = useStore();
  const [isAddingFood, setIsAddingFood] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SimpleFood[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [grams, setGrams] = useState<number>(100);
  const [typeFilter, setTypeFilter] = useState<DataTypeOpt>("Foundation");
  const [unbrandedFirst, setUnbrandedFirst] = useState<boolean>(true);
  const [searching, setSearching] = useState(false);

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

  const idQuery = "search-query";
  const idTypeFilter = "type-filter";
  const idUnbranded = "unbranded-first";
  const idGrams = "grams-input";

  return (
    <>
      <label htmlFor={idQuery} className="sr-only">Search foods</label>
      <input id={idQuery} className="form-input" placeholder="Search foods…" value={query} onChange={e => setQuery(e.target.value)} />
      <div className="flex items-center gap-2">
        <div className="flex flex-col">
          <label htmlFor={idTypeFilter} className="text-sm">Data type</label>
          <select
            id={idTypeFilter}
            className="form-input"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as DataTypeOpt)}
            title="Filter results by USDA data type"
          >
            {DATA_TYPE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 text-sm text-text dark:text-text-light whitespace-nowrap">
          <input
            id={idUnbranded}
            type="checkbox"
            className="rounded text-brand-primary focus:ring-brand-primary"
            checked={unbrandedFirst}
            onChange={(e) => setUnbrandedFirst(e.target.checked)}
          />
          <label htmlFor={idUnbranded} className="cursor-pointer">Unbranded first</label>
        </div>
      </div>
      {allMyFoods.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-1 text-text-muted dark:text-text-muted-dark">My Foods</h4>
          <ul className="border-border-light border rounded-md divide-y dark:border-border-dark dark:divide-border-dark max-h-40 overflow-auto">
            {myFoodsFiltered.map((f) => (
              <li
                key={f.fdcId}
                className={`p-2 flex justify-between items-center cursor-pointer ${selected === f.fdcId ? 'bg-brand-primary/20 dark:bg-brand-primary/30' : 'hover:bg-surface-light dark:hover:bg-border-dark'}`}
                onClick={() => setSelected(f.fdcId)}
              >
                <div className="font-medium truncate text-sm">{f.description}</div>
                <button
                  className="btn btn-ghost btn-sm text-brand-danger hover:bg-brand-danger/10 dark:hover:bg-brand-danger/30"
                  title="Delete custom food"
                  aria-label="Delete custom food"
                  onClick={(e) => { e.stopPropagation(); handleDeleteCustomFood(f.fdcId); }}
                >🗑️</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <h4 className="font-semibold text-sm mb-1 text-text-muted dark:text-text-muted-dark">USDA Results</h4>
        <ul className="border-border-light border rounded-md divide-y dark:border-border-dark dark:divide-border-dark h-[250px] overflow-auto">
          {searching ? (<li className="p-2 text-text-muted">Searching...</li>) :
            results.map(r => (
              <li
                key={r.fdcId}
                className={`p-2 cursor-pointer ${selected === r.fdcId ? 'bg-brand-primary/20 dark:bg-brand-primary/30' : 'hover:bg-surface-light dark:hover:bg-border-dark'}`}
                onClick={() => setSelected(r.fdcId)}
              >
                <div className="font-medium text-sm">{r.description}</div>
                <div className="text-xs text-text-muted dark:text-text-muted-dark">{r.brandOwner || r.dataType}</div>
              </li>
            ))}
        </ul>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor={idGrams} className="text-sm">Grams</label>
        <input id={idGrams} className="form-input w-24" type="number" min={1} step={1} value={grams} onChange={e => setGrams(parseFloat(e.target.value))} />
        <button className="btn btn-primary w-full" onClick={handleAddSelectedFood} disabled={!selected || isAddingFood}>
          {isAddingFood ? 'Adding…' : `Add to ${mealName}`}
        </button>
      </div>
    </>
  );
}
