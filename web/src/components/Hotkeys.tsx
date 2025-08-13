import { useEffect, useState } from "react";
import { useStore } from "../store";
import { Button } from "./ui/Button";

export function Hotkeys() {
  const addMeal = useStore(s => s.addMeal);
  const toggleTheme = useStore(s => s.toggleTheme);
  const focusSearch = useStore(s => s.focusSearch);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (e.shiftKey && e.key === "?") {
        e.preventDefault();
        setShowHelp(o => !o);
        return;
      }
      if (e.key === "Escape") {
        setShowHelp(false);
      }
      if (e.ctrlKey || e.metaKey) {
        if (key === "m") {
          e.preventDefault();
          addMeal();
        } else if (key === "f") {
          e.preventDefault();
          focusSearch();
        } else if (e.shiftKey && key === "l") {
          e.preventDefault();
          toggleTheme();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [addMeal, toggleTheme, focusSearch]);

  if (!showHelp) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowHelp(false)}>
      <div
        className="bg-surface-light dark:bg-surface-dark rounded-md p-6 shadow-lg text-text dark:text-text-light"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h2 className="text-lg font-semibold mb-4">Keyboard Shortcuts</h2>
        <ul className="space-y-2 text-sm">
          <li><kbd className="px-1 py-0.5 rounded bg-border-light dark:bg-border-dark font-mono text-xs">Ctrl</kbd>+
              <kbd className="px-1 py-0.5 rounded bg-border-light dark:bg-border-dark font-mono text-xs">M</kbd> Add meal</li>
          <li><kbd className="px-1 py-0.5 rounded bg-border-light dark:bg-border-dark font-mono text-xs">Ctrl</kbd>+
              <kbd className="px-1 py-0.5 rounded bg-border-light dark:bg-border-dark font-mono text-xs">F</kbd> Focus search</li>
          <li><kbd className="px-1 py-0.5 rounded bg-border-light dark:bg-border-dark font-mono text-xs">Ctrl</kbd>+
              <kbd className="px-1 py-0.5 rounded bg-border-light dark:bg-border-dark font-mono text-xs">Shift</kbd>+
              <kbd className="px-1 py-0.5 rounded bg-border-light dark:bg-border-dark font-mono text-xs">L</kbd> Toggle theme</li>
          <li><kbd className="px-1 py-0.5 rounded bg-border-light dark:bg-border-dark font-mono text-xs">?</kbd> Toggle this help</li>
        </ul>
        <Button className="btn-primary mt-4" onClick={() => setShowHelp(false)}>Close</Button>
      </div>
    </div>
  );
}
