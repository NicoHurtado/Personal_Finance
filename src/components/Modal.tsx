"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const scrollYRef = useRef(0);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Lock body scroll while open — saves position so page doesn't jump
  useEffect(() => {
    if (!open) return;
    scrollYRef.current = window.scrollY;
    document.body.classList.add("modal-open");
    document.body.style.top = `-${scrollYRef.current}px`;
    return () => {
      document.body.classList.remove("modal-open");
      document.body.style.top = "";
      window.scrollTo(0, scrollYRef.current);
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 z-[9999] flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="
          bg-card w-full sm:max-w-md
          rounded-t-2xl sm:rounded-xl
          border border-[var(--c-border)]
          max-h-[90dvh] sm:max-h-[85vh]
          flex flex-col
          shadow-lg
          pb-[env(safe-area-inset-bottom)]
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-9 h-1 rounded-full bg-[var(--c-border)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--c-border)] shrink-0">
          <h3 className="text-[15px] font-medium text-[var(--c-text)]">{title}</h3>
          <button
            onClick={onClose}
            className="text-[var(--c-text-3)] hover:text-[var(--c-text)] transition-colors p-1 -mr-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto overscroll-contain px-5 py-5 flex-1">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
