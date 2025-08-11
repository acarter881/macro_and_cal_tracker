import { useMemo, useState, useEffect } from "react";
import toast from 'react-hot-toast';
import { useStore } from "../store";
import type { MealType } from "../types";

export function DailyLog() {
  const { day, mealName, setDate, setMealName, addMeal, updateEntry, deleteEntry, deleteMeal, renameMeal, moveMeal, copiedMealId, copyMeal, pasteMeal } = useStore();

  const [isAddingMeal, setIsAddingMeal] = useState(false);
  const [isPasting, setIsPasting] = useState(false);
  const [draggedMealId, setDraggedMealId] = useState<number | null>(null);

  const handleAddMeal = async () => {
    setIsAddingMeal(true);
    await addMeal();
    setIsAddingMeal(false);
  }

  const handlePasteMeal = async () => {
    setIsPasting(true);
    await pasteMeal();
    setIsPasting(false);
  }

  const handleDragStart = (id: number) => setDraggedMealId(id);

  const handleDrop = (id: number) => {
    if (draggedMealId == null || draggedMealId === id) return;
    const target = pickerMeals.find(m => m.id === id);
    if (!target) return;
    moveMeal(draggedMealId, target.sort_order);
    setDraggedMealId(null);
  };
  
  const pickerMeals = useMemo(() => {
    if ((day?.meals?.length ?? 0) > 0) {
      return [...day!.meals].sort((a, b) => a.sort_order - b.sort_order);
    }
    return [];
  }, [day]);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-body flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="date-picker" className="font-semibold text-sm">Date:</label>
            <input id="date-picker" className="form-input" type="date" value={day?.date ?? new Date().toISOString().slice(0, 10)} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <select className="form-input" value={mealName} onChange={e => setMealName(e.target.value)}>
              {pickerMeals.map(m => (<option key={m.id}>{m.name}</option>))}
            </select>
            
            {copiedMealId && (
              <button type="button" className="btn btn-secondary whitespace-nowrap" onClick={handlePasteMeal} disabled={isPasting}>
                {isPasting ? "Pasting..." : `Paste to ${mealName}`}
              </button>
            )}

            <button type="button" className="btn btn-secondary" onClick={handleAddMeal} disabled={isAddingMeal}>
              {isAddingMeal ? "+ ..." : "+ Meal"}
            </button>
          </div>
        </div>
      </div>
      {(day?.meals ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(m => (
          <MealCard
            key={m.id}
            meal={m}
            isCurrent={m.name === mealName}
            onSelect={() => setMealName(m.name)}
            onUpdateEntry={updateEntry}
            onDeleteEntry={deleteEntry}
            onDeleteMeal={deleteMeal}
            onCopyMeal={copyMeal}
            onRenameMeal={renameMeal}
            onDragStart={() => handleDragStart(m.id)}
            onDrop={() => handleDrop(m.id)}
          />
        ))}
    </div>
  );
}

// --- Child Components ---

type MealCardProps = {
  meal: MealType; isCurrent: boolean; onSelect: () => void;
  onUpdateEntry: (entryId: number, grams: number) => Promise<void>;
  onDeleteEntry: (entryId: number) => Promise<void>;
  onDeleteMeal: (mealId: number) => Promise<void>;
  onCopyMeal: (mealId: number) => void;
  onRenameMeal: (mealId: number, newName: string) => Promise<void>;
  onDragStart: () => void;
  onDrop: () => void;
};

function MealCard({ meal, isCurrent, onSelect, onUpdateEntry, onDeleteEntry, onDeleteMeal, onCopyMeal, onRenameMeal, onDragStart, onDrop }: MealCardProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [tempName, setTempName] = useState(meal.name);
  useEffect(() => setTempName(meal.name), [meal.name]);
  const submitRename = async () => {
    await onRenameMeal(meal.id, tempName);
    setIsRenaming(false);
  };
  return (
    <div
      className={`card ${isCurrent ? "ring-2 ring-brand-primary" : ""}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={e => e.preventDefault()}
      onDrop={onDrop}
    >
      <div className="card-header bg-surface-light dark:bg-border-dark flex items-center relative py-3" onClick={!isRenaming ? onSelect : undefined}>
        {isRenaming ? (
          <form className="flex-1 flex items-center gap-2" onSubmit={e => { e.preventDefault(); submitRename(); }}>
            <input className="form-input flex-1 py-1" value={tempName} onChange={e => setTempName(e.target.value)} autoFocus />
            <button type="submit" className="btn btn-secondary btn-sm">Save</button>
          </form>
        ) : (
          <h3 className="flex-1 text-center font-semibold text-lg dark:text-text-light">{meal.name}</h3>
        )}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button
              type="button"
              title="Rename meal"
              aria-label="Rename meal"
              onClick={(e) => { e.stopPropagation(); setIsRenaming(true); }}
              className="btn btn-ghost btn-sm"
            >
              ✏️
            </button>
            <button
              type="button"
              title="Copy meal"
              aria-label="Copy meal"
              onClick={(e) => { e.stopPropagation(); onCopyMeal(meal.id); }}
              className="btn btn-ghost btn-sm"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            </button>
            {meal.entries.length === 0 && (
              <button
                type="button"
                title="Delete empty meal"
                aria-label="Delete empty meal"
                onClick={(e) => { e.stopPropagation(); onDeleteMeal(meal.id); }}
                className="btn btn-ghost btn-sm"
              >
                🗑️
              </button>
            )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm table-fixed table-zebra">
          <colgroup>
            <col />
            <col className="w-24" />
            <col className="w-20" />
            <col className="w-16" />
            <col className="w-16" />
            <col className="w-16" />
            <col className="w-36" />
          </colgroup>
          <thead>
            <tr className="border-b border-border-light dark:border-border-dark">
              <th className="text-left p-3 font-medium">Item</th>
              <th className="text-right p-3 font-medium">Qty (g)</th>
              <th className="text-right p-3 font-medium">kcal</th>
              <th className="text-right p-3 font-medium">F</th>
              <th className="text-right p-3 font-medium">C</th>
              <th className="text-right p-3 font-medium">P</th>
              <th className="p-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {meal.entries.length ? (meal.entries.map(e => (<Row key={e.id} e={e} onUpdate={onUpdateEntry} onDelete={onDeleteEntry} />))) :
              (<tr><td className="p-4 text-text-muted text-center" colSpan={7}>No entries yet.</td></tr>)}
          </tbody>
          <tfoot>
            <tr className="font-semibold border-t-2 border-border-light dark:border-border-dark">
                <td className="p-3 text-right" colSpan={2}>Subtotal</td>
                <td className="p-3 text-right subtotal-kcal">{meal.subtotal.kcal.toFixed(1)}</td>
                <td className="p-3 text-right subtotal-fat">{meal.subtotal.fat.toFixed(1)}</td>
                <td className="p-3 text-right subtotal-carb">{meal.subtotal.carb.toFixed(1)}</td>
                <td className="p-3 text-right subtotal-protein">{meal.subtotal.protein.toFixed(1)}</td>
                <td className="p-3 text-right"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

type EntryType = { id: number; description: string; quantity_g: number; kcal: number; protein: number; carb: number; fat: number };
type RowProps = { e: EntryType, onUpdate: (id: number, grams: number) => Promise<void>, onDelete: (id: number) => Promise<void> };

function Row({ e, onUpdate, onDelete }: RowProps) {
  const [g, setG] = useState<number>(e.quantity_g);
  const [isMutating, setIsMutating] = useState(false);
  const changed = g !== e.quantity_g;
  
  useEffect(() => { setG(e.quantity_g); }, [e.quantity_g]);

  const handleUpdate = async () => {
    setIsMutating(true);
    try {
      await onUpdate(e.id, g);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to update entry.");
    } finally {
      setIsMutating(false);
    }
  }

  const handleDelete = async () => {
    setIsMutating(true);
    try {
      await onDelete(e.id);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to delete entry.");
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <tr className="border-t border-border-light dark:border-border-dark">
      <td className="p-2 text-left font-medium">{e.description}</td>
      <td className="p-2 text-right">
        {(() => {
          const id = `entry-${e.id}-qty`;
          return (
            <>
              <label htmlFor={id} className="sr-only">Quantity in grams</label>
              <input
                id={id}
                className="form-input text-right w-20 py-1"
                type="number"
                min={1}
                step={1}
                value={g}
                onChange={ev=>setG(parseFloat(ev.target.value))}
                disabled={isMutating}
              />
            </>
          );
        })()}
      </td>
      <td className="p-2 text-right">{e.kcal.toFixed(1)}</td>
      <td className="p-2 text-right">{e.fat.toFixed(1)}</td>
      <td className="p-2 text-right">{e.carb.toFixed(1)}</td>
      <td className="p-2 text-right">{e.protein.toFixed(1)}</td>
      <td className="p-2 text-right">
        <div className="flex gap-2 justify-end">
          <button className="btn btn-secondary btn-sm" disabled={!changed || isNaN(g) || g <= 0 || isMutating} onClick={handleUpdate}>{isMutating ? "..." : "Update"}</button>
          <button className="btn btn-ghost btn-sm text-brand-danger hover:bg-brand-danger/10 dark:hover:bg-brand-danger/30" onClick={handleDelete} disabled={isMutating}>{isMutating ? "..." : "Delete"}</button>
        </div>
      </td>
    </tr>
  )
}