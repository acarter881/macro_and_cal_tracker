import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useStore } from "./store";
import { TrackerPage } from "./pages/TrackerPage";
import { DashboardPage } from "./pages/DashboardPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { Layout } from "./components/Layout";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { UsdaKeyDialog } from "./components/UsdaKeyDialog";
import * as api from "./api";

export default function App() {
  const init = useStore((state) => state.init);
  const [loading, setLoading] = useState(true);
  const [needsKey, setNeedsKey] = useState(false);

  useEffect(() => {
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
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [init]);

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
