import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useStore } from "./store";
import { TrackerPage } from "./pages/TrackerPage";
import { DashboardPage } from "./pages/DashboardPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { Layout } from "./components/Layout";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { Button } from "./components/ui/Button";

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
      <div className="min-h-screen bg-surface-light dark:bg-surface-dark font-sans">
        <Toaster position="bottom-center" toastOptions={{ style: { background: '#363636', color: '#fff' }, success: { duration: 3000 } }} />

        <header className="sticky top-0 z-10 bg-surface-light dark:bg-surface-dark">
          <div className="mx-auto flex items-center justify-between px-4 py-4 lg:px-6">
            <div className="flex items-center gap-2">
              <Button className="btn-ghost lg:hidden text-text dark:text-text-light" onClick={() => setMenuOpen(true)}>
                <Bars3Icon className="h-6 w-6" />
              </Button>
              <h1 className="text-xl lg:text-3xl font-bold text-text dark:text-text-light">Macro Tracker</h1>
            </div>
            <div className="flex items-center gap-4">
              <nav className="hidden lg:flex items-center gap-4">
                {navItems.map(({ to, label, icon: Icon }) => (
                  <NavLink key={to} to={to} className={navLinkClass}>
                    <Icon className="h-5 w-5" />
                    {label}
                  </NavLink>
                ))}
              </nav>
              <ThemeToggle />
            </div>
          </div>
        </header>
        <div className={`fixed inset-0 z-20 transform transition-transform duration-200 lg:hidden ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)}></div>
          <div className="relative bg-surface-light dark:bg-surface-dark w-64 h-full p-4">
            <Button className="btn-ghost mb-4 text-text dark:text-text-light" onClick={() => setMenuOpen(false)}>
              <XMarkIcon className="h-6 w-6" />
            </Button>
            <nav className="flex flex-col gap-2">
              {navItems.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} className={navLinkClass} onClick={() => setMenuOpen(false)}>
                  <Icon className="h-5 w-5" />
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
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
