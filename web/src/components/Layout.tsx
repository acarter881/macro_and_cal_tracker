import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { Toaster } from 'react-hot-toast';
import { ThemeToggle } from "./ThemeToggle";
import { Hotkeys } from "./Hotkeys";
import {
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  ChartBarIcon,
  SignalIcon,
  SignalSlashIcon,
} from "@heroicons/react/24/outline";
import { getOfflineQueueSize } from "../api";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [queueSize, setQueueSize] = useState(getOfflineQueueSize());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.body.classList.add('overflow-hidden');
      document.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.classList.remove('overflow-hidden');
    }

    return () => {
      document.body.classList.remove('overflow-hidden');
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    const updateQueue = (e: Event) => {
      const detail = (e as CustomEvent<number>).detail;
      setQueueSize(typeof detail === "number" ? detail : getOfflineQueueSize());
    };
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    window.addEventListener('offline-queue-changed', updateQueue as EventListener);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
      window.removeEventListener('offline-queue-changed', updateQueue as EventListener);
    };
  }, []);

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
    <div className="min-h-screen bg-surface-light dark:bg-surface-dark font-sans">
      <Toaster position="bottom-center" toastOptions={{ style: { background: '#363636', color: '#fff' }, success: { duration: 3000 } }} />
      <Hotkeys />

      <header className="sticky top-0 z-10 bg-surface-light dark:bg-surface-dark">
        <div className="mx-auto flex items-center justify-between px-4 py-4 lg:px-6">
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
            <div className="relative" title={isOnline ? 'Online' : 'Offline'}>
              {isOnline ? (
                <SignalIcon className="h-5 w-5 text-brand-success" />
              ) : (
                <SignalSlashIcon className="h-5 w-5 text-brand-danger" />
              )}
              {queueSize > 0 && (
                <span className="absolute -top-1 -right-1 bg-brand-primary text-text-light text-xs rounded-full px-1">
                  {queueSize}
                </span>
              )}
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className={`fixed inset-0 z-20 transform transition-transform duration-200 lg:hidden ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)}></div>
        <div className="relative bg-surface-light dark:bg-surface-dark w-64 h-full p-4">
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

      <main className="mx-auto px-4 py-6 lg:px-6">{children}</main>
    </div>
  );
}

