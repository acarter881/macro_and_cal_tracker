import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from 'react-hot-toast';
import { useStore } from "../../store";
import * as api from "../../api";
import { DATA_TYPE_OPTIONS } from "../../types";
import type { DataTypeOpt, SimpleFood } from "../../types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

export function SearchTab() {
  const { mealName, allMyFoods, setAllMyFoods, addFood, favorites, toggleFavorite } = useStore();
  const [isAddingFood, setIsAddingFood] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SimpleFood[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [highlightIndex, setHighlightIndex] = useState<number>(-1);
  const [grams, setGrams] = useState<number>(100);
  const [typeFilter, setTypeFilter] = useState<DataTypeOpt>("Foundation");
  const [unbrandedFirst, setUnbrandedFirst] = useState<boolean>(true);
  const [searching, setSearching] = useState(false);
  const [showMyFoods, setShowMyFoods] = useState(false);
  const queryRef = useRef<HTMLInputElement>(null);

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

  const handleAddSelectedFood = useCallback(async (fdcId?: number) => {
    const id = fdcId ?? selected;
    if (!id) return;
    setIsAddingFood(true);
    await addFood(id, grams);
    setIsAddingFood(false);
  }, [addFood, grams, selected]);

  useEffect(() => {
    if (results.length > 0) {
      setHighlightIndex(0);
      setSelected(results[0].fdcId);
    } else {
      setHighlightIndex(-1);
      setSelected(null);
    }
  }, [results]);

  useEffect(() => {
    const el = queryRef.current;
    if (!el) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIndex(i => {
          const next = Math.min(results.length - 1, i + 1);
          setSelected(results[next]?.fdcId ?? null);
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIndex(i => {
          const next = Math.max(0, i - 1);
          setSelected(results[next]?.fdcId ?? null);
          return next;
        });
      } else if (e.key === 'Enter' && highlightIndex >= 0) {
        e.preventDefault();
        handleAddSelectedFood(results[highlightIndex].fdcId);
      }
    };
    el.addEventListener('keydown', onKeyDown);
    return () => el.removeEventListener('keydown', onKeyDown);
  }, [results, highlightIndex, handleAddSelectedFood]);

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
      <Input
        id={idQuery}
        ref={queryRef}
        placeholder="Search foods…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        role="combobox"
        aria-autocomplete="list"
        aria-controls="search-results"
        aria-activedescendant={highlightIndex >= 0 ? `search-result-${results[highlightIndex].fdcId}` : undefined}
        aria-expanded={results.length > 0}
      />
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
          <Input
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
          <button
            type="button"
            className="w-full flex justify-between items-center font-semibold text-sm mb-1 text-text-muted dark:text-text-muted-dark"
            onClick={() => setShowMyFoods(!showMyFoods)}
            aria-expanded={showMyFoods}
          >
            <span>My Foods</span>
            <span className={`transform transition-transform duration-200 ${showMyFoods ? 'rotate-180' : 'rotate-90'}`}>›</span>
          </button>
          {showMyFoods && (
            <ul className="border-border-light border rounded-md divide-y dark:border-border-dark dark:divide-border-dark max-h-40 overflow-auto">
              {myFoodsFiltered.map((f) => (
                <li
                  key={f.fdcId}
                  className={`p-2 flex justify-between items-center cursor-pointer ${selected === f.fdcId ? 'bg-brand-primary/20 dark:bg-brand-primary/30' : 'hover:bg-surface-light dark:hover:bg-border-dark'}`}
                  onClick={() => setSelected(f.fdcId)}
                >
                  <div className="font-medium truncate text-sm">{f.description}</div>
                  <div className="flex items-center gap-1">
                    <Button
                      className="btn-ghost btn-sm"
                      title={favorites.some(fav => fav.fdcId === f.fdcId) ? 'Remove favorite' : 'Add favorite'}
                      aria-label={favorites.some(fav => fav.fdcId === f.fdcId) ? 'Remove favorite' : 'Add favorite'}
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(f); }}
                    >{favorites.some(fav => fav.fdcId === f.fdcId) ? '⭐' : '☆'}</Button>
                    {f.dataType === 'Custom' && (
                      <Button
                        className="btn-ghost btn-sm text-brand-danger hover:bg-brand-danger/10 dark:hover:bg-brand-danger/30"
                        title="Delete custom food"
                        aria-label="Delete custom food"
                        onClick={(e) => { e.stopPropagation(); handleDeleteCustomFood(f.fdcId); }}
                      >🗑️</Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
        <div>
          <h4 className="font-semibold text-sm mb-1 text-text-muted dark:text-text-muted-dark">USDA Results</h4>
          <ul
            id="search-results"
            role="listbox"
            className="border-border-light border rounded-md divide-y dark:border-border-dark dark:divide-border-dark h-[250px] overflow-auto"
          >
            {searching ? (
              <li className="p-2 text-text-muted">Searching...</li>
            ) : (
              results.map((r, idx) => (
                <li
                  key={r.fdcId}
                  id={`search-result-${r.fdcId}`}
                  role="option"
                  aria-selected={highlightIndex === idx}
                  className={`p-2 flex justify-between items-center cursor-pointer ${highlightIndex === idx ? 'bg-brand-primary/20 dark:bg-brand-primary/30' : 'hover:bg-surface-light dark:hover:bg-border-dark'}`}
                  onClick={() => {
                    setSelected(r.fdcId);
                    setHighlightIndex(idx);
                  }}
                >
                  <div>
                    <div className="font-medium text-sm">{r.description}</div>
                    <div className="text-xs text-text-muted dark:text-text-muted-dark">{r.brandOwner || r.dataType}</div>
                  </div>
                  <Button
                    className="btn-ghost btn-sm"
                    title={favorites.some(f => f.fdcId === r.fdcId) ? 'Remove favorite' : 'Add favorite'}
                    aria-label={favorites.some(f => f.fdcId === r.fdcId) ? 'Remove favorite' : 'Add favorite'}
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(r); }}
                  >{favorites.some(f => f.fdcId === r.fdcId) ? '⭐' : '☆'}</Button>
                </li>
              ))
            )}
          </ul>
        </div>
      <div className="flex items-center gap-2">
        <label htmlFor={idGrams} className="text-sm">Grams</label>
        <Input id={idGrams} className="w-24" type="number" min={1} step={1} value={grams} onChange={e => setGrams(parseFloat(e.target.value))} />
        <Button className="btn-primary w-full" onClick={() => handleAddSelectedFood()} disabled={!selected || isAddingFood}>
          {isAddingFood ? 'Adding…' : `Add to ${mealName}`}
        </Button>
      </div>
    </>
  );
}
