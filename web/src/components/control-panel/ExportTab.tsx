import { useState } from "react";
import toast from 'react-hot-toast';
import * as api from "../../api";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

export function ExportTab() {
  const [exportStart, setExportStart] = useState<string>(new Date().toISOString().slice(0, 10));
  const [exportEnd, setExportEnd] = useState<string>(new Date().toISOString().slice(0, 10));
  const [isExporting, setIsExporting] = useState(false);
  const invalidRange = !exportStart || !exportEnd || exportStart > exportEnd;

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

  const ids = { from: "export-start", to: "export-end" } as const;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label htmlFor={ids.from} className="text-sm">From:</label>
        <Input id={ids.from} type="date" value={exportStart} onChange={e=>setExportStart(e.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor={ids.to} className="text-sm">To:</label>
        <Input id={ids.to} type="date" value={exportEnd} onChange={e=>setExportEnd(e.target.value)} />
      </div>
      <Button disabled={invalidRange || isExporting} className="btn-secondary w-full" onClick={handleExport}>
        {isExporting ? 'Downloading...' : 'Download CSV'}
      </Button>
    </div>
  );
}
