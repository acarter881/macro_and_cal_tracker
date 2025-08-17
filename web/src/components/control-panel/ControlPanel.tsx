import { useState, type ElementType } from "react";
import { SearchTab } from "./SearchTab";
import { CustomFoodTab } from "./CustomFoodTab";
import { PresetsTab } from "./PresetsTab";
import { GoalsTab } from "./GoalsTab";
import { ExportTab } from "./ExportTab";
import { Button } from "../ui/Button";
import {
  ArrowDownTrayIcon,
  FlagIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  PlusCircleIcon,
} from "@heroicons/react/24/outline";

type TabKey = "search" | "custom" | "presets" | "goals" | "export";
const tabs: { key: TabKey; label: string; icon: ElementType }[] = [
  { key: "search", label: "Search", icon: MagnifyingGlassIcon },
  { key: "custom", label: "Custom Food", icon: PlusCircleIcon },
  { key: "presets", label: "Presets", icon: ListBulletIcon },
  { key: "goals", label: "Goals", icon: FlagIcon },
  { key: "export", label: "Export", icon: ArrowDownTrayIcon },
];

export function ControlPanel() {
  const [tab, setTab] = useState<TabKey>("search");

  return (
    <div className="card flex overflow-hidden">
      <nav className="flex w-16 flex-col border-r sm:w-48">
        {tabs.map(({ key, label, icon: Icon }) => (
          <Button
            key={key}
            onClick={() => setTab(key)}
            aria-label={label}
            className={`btn-ghost flex w-full items-center justify-center gap-1 rounded-none border-l-4 px-2 py-3 text-sm font-medium sm:justify-start sm:gap-2 ${
              tab === key
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-text-muted hover:text-text dark:hover:text-text-light"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span className="hidden sm:inline">{label}</span>
          </Button>
        ))}
      </nav>
      <div className="card-body flex-1 space-y-4">
        {tab === "search" && <SearchTab />}
        {tab === "custom" && <CustomFoodTab />}
        {tab === "presets" && <PresetsTab />}
        {tab === "goals" && <GoalsTab />}
        {tab === "export" && <ExportTab />}
      </div>
    </div>
  );
}
