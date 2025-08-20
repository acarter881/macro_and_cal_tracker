import { useEffect, useState, useRef, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ open, onClose, children }: ModalProps) {
  const [show, setShow] = useState(open);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const FOCUSABLES =
    'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

  // handle mount/unmount for close animation and focus restore
  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      setShow(true);
      return;
    }
    previouslyFocused.current?.focus();
    previouslyFocused.current = null;
    const t = setTimeout(() => setShow(false), 200);
    return () => clearTimeout(t);
  }, [open]);

  // focus first element when shown
  useEffect(() => {
    if (open && show) {
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLES);
      (focusable && focusable.length > 0
        ? focusable[0]
        : dialogRef.current)
        ?.focus();
    }
  }, [open, show]);

  // keyboard dismissal and focus trap
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLES);
        if (!focusable || focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }
    if (open) {
      document.addEventListener("keydown", handleKey);
      return () => document.removeEventListener("keydown", handleKey);
    }
  }, [open, onClose]);

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 transition-opacity duration-200 ${
        open ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className={`bg-surface-light dark:bg-surface-dark rounded-md p-6 shadow-lg text-text dark:text-text-light transition-transform duration-200 ${
          open ? "scale-100" : "scale-95"
        }`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export default Modal;
