import { LoadingSpinner } from "./LoadingSpinner";
import { useStore } from "../store";

export function BusyOverlay() {
  const busy = useStore((state) => state.busy);
  if (!busy) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <LoadingSpinner />
    </div>
  );
}
