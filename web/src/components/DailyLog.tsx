import { useMemo, useState, useEffect } from "react";
import toast from 'react-hot-toast';
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import { addDays, subDays } from "date-fns";
import { useStore } from "../store";
import type { MealType, EntryType } from "../types";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

export function DailyLog() {
  const { day, mealName, setDate, setMealName, addMeal, updateEntry, moveEntry, deleteEntry, deleteMeal, renameMeal, moveMeal, copiedMealId, copyMeal, pasteMeal } = useStore();

  const [isAddingMeal, setIsAddingMeal] = useState(false);
  const [isPasting, setIsPasting] = useState(false);

  const currentDate = day?.date ?? new Date().toISOString().slice(0, 10);

  const handleAddMeal = async () => {
    setIsAddingMeal(true);
    await addMeal();
    setIsAddingMeal(false);
  };

  const handlePasteMeal = async () => {
    setIsPasting(true);
    await pasteMeal();
    setIsPasting(false);
  };

  const pickerMeals = useMemo(() => {
    if ((day?.meals?.length ?? 0) > 0) {
      return [...day!.meals].sort((a, b) => a.sort_order - b.sort_order);
    }
    return [];
  }, [day]);

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId, type } = result;
    if (!destination) return;
    if (type === "MEAL") {
      const meal = pickerMeals[source.index];
      if (!meal) return;
      const newOrder = destination.index + 1;
      moveMeal(meal.id, newOrder);
    } else if (type === "ENTRY") {
      if (destination.droppableId !== source.droppableId) return;
      const entryId = parseInt(draggableId.replace("entry-", ""), 10);
      const newOrder = destination.index + 1;
      moveEntry(entryId, newOrder);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-body flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="date-picker" className="font-semibold text-sm">Date:</label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                aria-label="Previous day"
                className="btn-ghost btn-sm"
                onClick={() => setDate(subDays(new Date(currentDate), 1).toISOString().slice(0, 10))}
              >
                ←
              </Button>
              <Input
                id="date-picker"
                type="date"
                value={currentDate}
                onChange={e => setDate(e.target.value)}
              />
              <Button
                type="button"
                aria-label="Next day"
                className="btn-ghost btn-sm"
                onClick={() => setDate(addDays(new Date(currentDate), 1).toISOString().slice(0, 10))}
              >
                →
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select className="form-input" value={mealName} onChange={e => setMealName(e.target.value)}>
              {pickerMeals.map(m => (<option key={m.id}>{m.name}</option>))}
            </select>

            {copiedMealId && (
              <Button type="button" className="btn-secondary whitespace-nowrap" onClick={handlePasteMeal} disabled={isPasting}>
                {isPasting ? "Pasting..." : `Paste to ${mealName}`}
              </Button>
            )}

            <Button type="button" className="btn-secondary" onClick={handleAddMeal} disabled={isAddingMeal}>
              {isAddingMeal ? "+ ..." : "+ Meal"}
            </Button>
          </div>
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="meals" type="MEAL">
          {provided => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-6">
              {pickerMeals.map((m, index) => (
                <Draggable key={m.id} draggableId={`meal-${m.id}`} index={index}>
                  {providedMeal => (
                    <MealCard
                      meal={m}
                      isCurrent={m.name === mealName}
                      onSelect={() => setMealName(m.name)}
                      onUpdateEntry={updateEntry}
                      onDeleteEntry={deleteEntry}
                      onDeleteMeal={deleteMeal}
                      onCopyMeal={copyMeal}
                      onRenameMeal={renameMeal}
                      provided={providedMeal}
                    />
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
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
  provided: any;
};

function MealCard({ meal, isCurrent, onSelect, onUpdateEntry, onDeleteEntry, onDeleteMeal, onCopyMeal, onRenameMeal, provided }: MealCardProps) {
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
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
    >
      <div className="card-header bg-surface-light dark:bg-border-dark flex items-center relative py-3" onClick={!isRenaming ? onSelect : undefined}>
        {isRenaming ? (
          <form className="flex-1 flex items-center gap-2" onSubmit={e => { e.preventDefault(); submitRename(); }}>
            <Input className="flex-1 py-1" value={tempName} onChange={e => setTempName(e.target.value)} autoFocus />
            <Button type="submit" className="btn-secondary btn-sm">Save</Button>
          </form>
        ) : (
          <h3 className="flex-1 text-center font-semibold text-lg dark:text-text-light">{meal.name}</h3>
        )}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <Button
              type="button"
              title="Rename meal"
              aria-label="Rename meal"
              onClick={(e) => { e.stopPropagation(); setIsRenaming(true); }}
              className="btn-ghost btn-sm"
            >
              ✏️
            </Button>
            <Button
              type="button"
              title="Copy meal"
              aria-label="Copy meal"
              onClick={(e) => { e.stopPropagation(); onCopyMeal(meal.id); }}
              className="btn-ghost btn-sm"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            </Button>
            {meal.entries.length === 0 && (
              <Button
                type="button"
                title="Delete empty meal"
                aria-label="Delete empty meal"
                onClick={(e) => { e.stopPropagation(); onDeleteMeal(meal.id); }}
                className="btn-ghost btn-sm"
              >
                🗑️
              </Button>
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
          <Droppable droppableId={`entries-${meal.id}`} type="ENTRY">
            {providedEntries => (
              <tbody ref={providedEntries.innerRef} {...providedEntries.droppableProps}>
                {meal.entries.length ? (
                  meal.entries
                    .slice()
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((e, idx) => (
                      <Draggable key={e.id} draggableId={`entry-${e.id}`} index={idx}>
                        {providedRow => (
                          <Row e={e} onUpdate={onUpdateEntry} onDelete={onDeleteEntry} provided={providedRow} />
                        )}
                      </Draggable>
                    ))
                ) : (
                  <tr><td className="p-4 text-text-muted text-center" colSpan={7}>No entries yet.</td></tr>
                )}
                {providedEntries.placeholder}
              </tbody>
            )}
          </Droppable>
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

type RowProps = { e: EntryType, onUpdate: (id: number, grams: number) => Promise<void>, onDelete: (id: number) => Promise<void>, provided: any };

function Row({ e, onUpdate, onDelete, provided }: RowProps) {
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
    <tr className="border-t border-border-light dark:border-border-dark" ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
      <td className="p-2 text-left font-medium">{e.description}</td>
      <td className="p-2 text-right">
        {(() => {
          const id = `entry-${e.id}-qty`;
          return (
            <>
              <label htmlFor={id} className="sr-only">Quantity in grams</label>
              <Input
                id={id}
                className="text-right w-20 py-1"
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
          <Button className="btn-secondary btn-sm" disabled={!changed || isNaN(g) || g <= 0 || isMutating} onClick={handleUpdate}>{isMutating ? "..." : "Update"}</Button>
          <Button className="btn-ghost btn-sm text-brand-danger hover:bg-brand-danger/10 dark:hover:bg-brand-danger/30" onClick={handleDelete} disabled={isMutating}>{isMutating ? "..." : "Delete"}</Button>
        </div>
      </td>
    </tr>
  )
}
