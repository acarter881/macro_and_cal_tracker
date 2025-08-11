import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useStore } from "./store";
import { TrackerPage } from "./pages/TrackerPage";
import { DashboardPage } from "./pages/DashboardPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { Layout } from "./components/Layout";
import { LoadingSpinner } from "./components/LoadingSpinner";

export default function App() {
  const init = useStore(state => state.init);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    init().finally(() => setLoading(false));
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
