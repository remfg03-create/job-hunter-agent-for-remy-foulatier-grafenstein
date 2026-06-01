"use client";

import { useEffect } from "react";
import { X } from "./Icons";

export default function Modal({
  title,
  subtitle,
  onClose,
  children,
  maxWidth = "max-w-2xl",
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`glass rounded-3xl w-full ${maxWidth} max-h-[88vh] flex flex-col fadeup`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 p-6 border-b border-white/10">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">{title}</h2>
            {subtitle && <p className="text-sm text-white/50 mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer shrink-0 w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center"
            aria-label="Close"
          >
            <X />
          </button>
        </header>
        <div className="p-6 overflow-y-auto scroll-thin">{children}</div>
      </div>
    </div>
  );
}
