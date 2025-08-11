import { useState } from "react";
import toast from 'react-hot-toast';
import * as api from "../../api";

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
        <input id={ids.from} className="form-input" type="date" value={exportStart} onChange={e=>setExportStart(e.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor={ids.to} className="text-sm">To:</label>
        <input id={ids.to} className="form-input" type="date" value={exportEnd} onChange={e=>setExportEnd(e.target.value)} />
      </div>
      <button disabled={invalidRange || isExporting} className="btn btn-secondary w-full" onClick={handleExport}>
        {isExporting ? 'Downloading...' : 'Download CSV'}
      </button>
    </div>
  );
}
