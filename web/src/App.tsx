import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useStore } from "./store";
import { TrackerPage } from "./pages/TrackerPage";
import { DashboardPage } from "./pages/DashboardPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { Layout } from "./components/Layout";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { UsdaKeyDialog } from "./components/UsdaKeyDialog";
import { Onboarding } from "./components/Onboarding";
import { getUsdaKey } from "./api/foods";
import toast from "react-hot-toast";
import { Button } from "./components/ui/Button";

export default function App() {
  const init = useStore((state) => state.init);
  const [loading, setLoading] = useState(true);
  const [needsKey, setNeedsKey] = useState(false);
  const [onboarded, setOnboarded] = useState(
    () => !!localStorage.getItem("onboarding-complete")
  );
  const [initError, setInitError] = useState<string | null>(null);

  const completeOnboarding = () => {
    localStorage.setItem("onboarding-complete", "true");
    setOnboarded(true);
  };

  const initialize = useCallback(async () => {
    setLoading(true);
    setInitError(null);
    try {
      await init();
      const key = await getUsdaKey();
      setNeedsKey(!key);
    } catch (err) {
      console.error("Failed to initialize application", err);
      toast.error("Failed to reach backend. Some features may not work.");
      setInitError("Failed to reach backend.");
    } finally {
      setLoading(false);
    }
  }, [init]);

  useEffect(() => {
    if (!onboarded) return;
    initialize();
  }, [initialize, onboarded]);

  useEffect(() => {
    const handleOnline = () => {
      if (initError) {
        initialize();
      }
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [initError, initialize]);
  if (!onboarded) {
    return <Onboarding onComplete={completeOnboarding} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-light dark:bg-surface-dark">
        <LoadingSpinner />
      </div>
    );
  }

  if (initError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-4 bg-surface-light dark:bg-surface-dark">
        <p className="text-center text-text dark:text-text-light">
          Failed to reach backend.
        </p>
        <Button className="btn-primary" onClick={initialize}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <BrowserRouter>
      {needsKey && <UsdaKeyDialog onSaved={() => setNeedsKey(false)} />}
      <Layout>
        <Routes>
          <Route path="/" element={<TrackerPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
