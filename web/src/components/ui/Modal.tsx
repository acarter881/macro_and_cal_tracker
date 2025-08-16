import { useEffect, useState, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ open, onClose, children }: ModalProps) {
  const [show, setShow] = useState(open);

  // handle mount/unmount for close animation
  useEffect(() => {
    if (open) {
      setShow(true);
      return;
    }
    const t = setTimeout(() => setShow(false), 200);
    return () => clearTimeout(t);
  }, [open]);

  // keyboard dismissal
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
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
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      onClick={onClose}
    >
      <div
        className={`bg-surface-light dark:bg-surface-dark rounded-md p-6 shadow-lg text-text dark:text-text-light transition-transform duration-200 ${open ? "scale-100" : "scale-95"}`}
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export default Modal;
