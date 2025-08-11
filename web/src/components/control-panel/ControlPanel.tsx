import { useState } from "react";
import { SearchTab } from "./SearchTab";
import { CustomFoodTab } from "./CustomFoodTab";
import { PresetsTab } from "./PresetsTab";
import { GoalsTab } from "./GoalsTab";
import { ExportTab } from "./ExportTab";

type TabKey = 'search' | 'custom' | 'presets' | 'goals' | 'export';
const tabs: { key: TabKey; label: string }[] = [
  { key: 'search', label: 'Search' },
  { key: 'custom', label: 'Custom Food' },
  { key: 'presets', label: 'Presets' },
  { key: 'goals', label: 'Goals' },
  { key: 'export', label: 'Export' },
];

export function ControlPanel() {
  const [tab, setTab] = useState<TabKey>('search');

  return (
    <div>
      <div className="card">
        <div className="card-header p-0">
          <div className="flex">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 px-3 py-2 text-sm font-medium border-b-2 ${
                  tab === t.key
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-text-muted hover:text-text dark:hover:text-text-light'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="card-body space-y-4">
          {tab === 'search' && <SearchTab />}
          {tab === 'custom' && <CustomFoodTab />}
          {tab === 'presets' && <PresetsTab />}
          {tab === 'goals' && <GoalsTab />}
          {tab === 'export' && <ExportTab />}
        </div>
      </div>
    </div>
  );
}
