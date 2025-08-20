import { ControlPanel } from "../components/control-panel/ControlPanel";
import { DailyLog } from "../components/DailyLog";
import { Summary } from "../components/Summary";
import { QuickAdd } from "../components/QuickAdd";
import { BusyOverlay } from "../components/BusyOverlay";

export function TrackerPage() {
  return (
    <div className="space-y-4">
      <BusyOverlay />
      <QuickAdd />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_3fr_1fr] gap-8">
        <ControlPanel />
        <DailyLog />
        <Summary />
      </div>
    </div>
  );
}
