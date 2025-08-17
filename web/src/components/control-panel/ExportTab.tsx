import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { exportCSV } from "../../api/meals";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { useStore } from "../../store";

export function ExportTab() {
  const today = new Date().toISOString().slice(0, 10);
  const selectedDate = useStore((state) => state.date);
  const defaultStart = selectedDate > today ? today : selectedDate;

  const [exportStart, setExportStart] = useState<string>(defaultStart);
  const [exportEnd, setExportEnd] = useState<string>(today);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    setExportStart(selectedDate > today ? today : selectedDate);
  }, [selectedDate, today]);

  const invalidRange = !exportStart || !exportEnd || exportStart > exportEnd;

  async function handleExport() {
    setIsExporting(true);
    try {
      const response = await exportCSV(exportStart, exportEnd);
      const blob = new Blob([response.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        response.headers["content-disposition"]
          ?.split("filename=")[1]
          ?.replace(/"/g, "") ||
        `macro_export_${exportStart}_to_${exportEnd}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
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
        <label htmlFor={ids.from} className="text-sm">
          From:
        </label>
        <Input
          id={ids.from}
          type="date"
          value={exportStart}
          onChange={(e) => setExportStart(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor={ids.to} className="text-sm">
          To:
        </label>
        <Input
          id={ids.to}
          type="date"
          value={exportEnd}
          onChange={(e) => setExportEnd(e.target.value)}
        />
      </div>
      <Button
        disabled={invalidRange || isExporting}
        className="btn-secondary w-full"
        onClick={handleExport}
      >
        {isExporting ? "Downloading..." : "Download CSV"}
      </Button>
    </div>
  );
}
