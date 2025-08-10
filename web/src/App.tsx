// web/src/App.tsx (replace entire file)

import { useEffect } from "react";
import { Toaster } from 'react-hot-toast';
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { useStore } from "./store";
import { ThemeToggle } from "./components/ThemeToggle";
import { TrackerPage } from "./pages/TrackerPage";
import { DashboardPage } from "./pages/DashboardPage";

export default function App() {
  const init = useStore(state => state.init);

  useEffect(() => {
    init();
  }, [init]);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
      isActive
        ? 'bg-indigo-600 text-white'
        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
    }`;

  return (
    <BrowserRouter>
      <div className="p-4 lg:p-6 w-full bg-gray-100 dark:bg-gray-900 min-h-screen font-sans">
        <Toaster position="bottom-center" toastOptions={{ style: { background: '#363636', color: '#fff' }, success: { duration: 3000 } }}/>
        
        <header className="sticky top-0 z-10 mb-6 flex items-center justify-between bg-gray-100 dark:bg-gray-900">
            <nav className="flex items-center gap-4">
                <h1 className="text-xl lg:text-3xl font-bold text-gray-800 dark:text-gray-100 mr-4">Macro Tracker</h1>
                <NavLink to="/" className={navLinkClass}>Tracker</NavLink>
                <NavLink to="/dashboard" className={navLinkClass}>Dashboard</NavLink>
            </nav>
            <ThemeToggle />
        </header>
        
        <main>
            <Routes>
                <Route path="/" element={<TrackerPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
            </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}