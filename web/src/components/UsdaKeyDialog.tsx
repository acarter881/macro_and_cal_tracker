import { useState } from "react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { updateUsdaKey } from "../api/foods";

interface Props {
  onSaved: () => void;
}

export function UsdaKeyDialog({ onSaved }: Props) {
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!key) return;
    setSaving(true);
    try {
      await updateUsdaKey(key);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
      <div className="bg-surface-card p-6 rounded shadow w-full max-w-sm">
        <h2 className="text-lg font-semibold mb-2">USDA API Key</h2>
        <p className="text-sm mb-4">Enter your USDA API key to enable food search.</p>
        <Input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="w-full mb-4"
          placeholder="API Key"
        />
        <div className="text-right">
          <Button onClick={save} disabled={!key || saving}>Save</Button>
        </div>
      </div>
    </div>
  );
}
