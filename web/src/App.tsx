// web/src/App.tsx (replace entire file)

import { useEffect, useState } from "react";
import { Toaster } from 'react-hot-toast';
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { useStore } from "./store";
import { ThemeToggle } from "./components/ThemeToggle";
import { TrackerPage } from "./pages/TrackerPage";
import { DashboardPage } from "./pages/DashboardPage";
import { Bars3Icon, XMarkIcon, HomeIcon, ChartBarIcon } from "@heroicons/react/24/outline";
import { LoadingSpinner } from "./components/LoadingSpinner";

export default function App() {
  const init = useStore(state => state.init);
  const [menuOpen, setMenuOpen] = useState(false);
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

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
      isActive
        ? 'bg-brand-primary text-text-light'
        : 'text-text dark:text-text-light hover:bg-surface-light dark:hover:bg-border-dark'
    }`;

  const navItems = [
    { to: '/', label: 'Tracker', icon: HomeIcon },
    { to: '/dashboard', label: 'Dashboard', icon: ChartBarIcon }
  ];

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gradient-to-br from-surface-light to-gray-100 dark:from-surface-dark dark:to-gray-900 font-sans">
        <Toaster position="bottom-center" toastOptions={{ style: { background: '#363636', color: '#fff' }, success: { duration: 3000 } }} />

        <header className="sticky top-0 z-10 bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark shadow-sm">
          <div className="max-w-screen-xl mx-auto flex items-center justify-between px-4 py-4 lg:px-6">
            <div className="flex items-center gap-2">
              <button className="lg:hidden text-text dark:text-text-light" onClick={() => setMenuOpen(true)}>
                <Bars3Icon className="h-6 w-6" />
              </button>
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
          <div className="relative bg-surface-light dark:bg-surface-dark w-64 h-full p-4 shadow-lg">
            <button className="mb-4 text-text dark:text-text-light" onClick={() => setMenuOpen(false)}>
              <XMarkIcon className="h-6 w-6" />
            </button>
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

        <main className="max-w-screen-xl mx-auto px-4 py-6 lg:px-6">
          <Routes>
            <Route path="/" element={<TrackerPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
