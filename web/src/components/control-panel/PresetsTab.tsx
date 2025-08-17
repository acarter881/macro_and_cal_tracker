import { useState } from "react";
import toast from 'react-hot-toast';
import { useStore } from "../../store";
import * as api from "../../api";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

export function PresetsTab() {
  const { date, presets, refreshPresets, applyPreset } = useStore();
  const currentMeal = useStore(state => state.day?.meals.find(m => m.name === state.mealName));
  const [newPresetName, setNewPresetName] = useState("");
  const [isSavingPreset, setIsSavingPreset] = useState(false);

  async function handleSavePreset() {
    if (!newPresetName.trim() || !currentMeal) return;
    setIsSavingPreset(true);
    try {
      await api.createPresetFromMeal(newPresetName.trim(), date, currentMeal.name);
      setNewPresetName("");
      await refreshPresets();
      toast.success('Preset saved!');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      toast.error(msg || "Failed to save preset.");
    } finally {
      setIsSavingPreset(false);
    }
  }

  const idPreset = "preset-name";

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor={idPreset} className="sr-only">Preset name</label>
        <Input id={idPreset} placeholder="Save current meal as..." value={newPresetName} onChange={(e) => setNewPresetName(e.target.value)} />
        <Button className="btn-secondary w-full" onClick={handleSavePreset} disabled={isSavingPreset || !currentMeal?.entries?.length || !newPresetName.trim()}>
          {isSavingPreset ? 'Saving...' : 'Save Preset'}
        </Button>
      </div>
      <div className="max-h-64 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-light dark:bg-border-dark/50"><tr><th className="text-left p-2">Name</th><th className="p-2 text-right">Actions</th></tr></thead>
          <tbody>
            {presets.map((p) => (
              <tr key={p.id} className="border-t border-border-light dark:border-border-dark">
                <td className="p-2">{p.name} ({p.item_count})</td>
                <td className="p-2 text-right">
                  <div className="flex gap-1 justify-end">
                    <Button className="btn-ghost btn-sm" onClick={() => applyPreset(p.id)}>Apply</Button>
                    <Button className="btn-ghost btn-sm text-brand-danger hover:bg-brand-danger/10 dark:hover:bg-brand-danger/30" onClick={async () => {
                      if (!confirm(`Delete preset "${p.name}"?`)) return;
                      await api.deletePreset(p.id);
                      await refreshPresets();
                    }}>Delete</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
