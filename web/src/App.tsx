import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useStore } from "./store";
import { TrackerPage } from "./pages/TrackerPage";
import { DashboardPage } from "./pages/DashboardPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { Layout } from "./components/Layout";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { UsdaKeyDialog } from "./components/UsdaKeyDialog";
import { Onboarding } from "./components/Onboarding";
import * as api from "./api";
import toast from "react-hot-toast";

export default function App() {
  const init = useStore((state) => state.init);
  const [loading, setLoading] = useState(true);
  const [needsKey, setNeedsKey] = useState(false);
  const [onboarded, setOnboarded] = useState(
    () => !!localStorage.getItem("onboarding-complete")
  );

  const completeOnboarding = () => {
    localStorage.setItem("onboarding-complete", "true");
    setOnboarded(true);
  };

  useEffect(() => {
    if (!onboarded) return;
    // Safeguard in case network requests hang indefinitely.
    const timeout = setTimeout(() => setLoading(false), 5000);
    const run = async () => {
      try {
        await init();
        const key = await api.getUsdaKey();
        setNeedsKey(!key);
      } catch (err) {
        // If the API call fails (e.g. backend is not running) the app would
        // previously hang on the loading screen leaving users with a blank
        // page.  Log the error and continue so the UI can render.
        console.error("Failed to initialize application", err);
        toast.error("Failed to reach backend. Some features may not work.");
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    };
    setLoading(true);
    run();
  }, [init, onboarded]);
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
