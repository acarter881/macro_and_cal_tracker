// web/src/pages/TrackerPage.tsx (New File)

import { ControlPanel } from "../components/ControlPanel";
import { DailyLog } from "../components/DailyLog";
import { Summary } from "../components/Summary";

export function TrackerPage() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <ControlPanel />
            <DailyLog />
            <Summary />
        </div>
    );
}