import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

const FloatingModal = ({
  open,
  title,
  eyebrow = "KaagapAI System",
  description,
  onClose,
  children,
  footer,
  maxWidth = "max-w-3xl",
  closeOnBackdropClick = true,
}) => {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[999998] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Dark Glassmorphism Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeOnBackdropClick ? onClose : undefined}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-0"
          />

          {/* Centered Floating Modal Window */}
          <motion.section
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`relative z-10 flex max-h-[90vh] w-full ${maxWidth} flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl backdrop-blur-xl`}
          >
            {/* Sticky Modal Header */}
            <header className="sticky top-0 z-20 flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-6 py-4.5 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#14532D]/10 text-[#14532D] ring-1 ring-[#14532D]/20">
                  <img src="/logo.png" alt="Seal" className="h-7 w-7 object-contain" />
                </div>
                <div>
                  {eyebrow ? (
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#C8A14A]">
                      {eyebrow}
                    </p>
                  ) : null}
                  <h2 className="text-lg font-black text-slate-900 leading-snug">{title}</h2>
                  {description ? (
                    <p className="mt-0.5 text-xs font-semibold text-slate-500">{description}</p>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:scale-95"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </header>

            {/* Scrollable Modal Content */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 custom-scrollbar space-y-4">
              {children}
            </div>

            {/* Sticky Modal Footer */}
            {footer ? (
              <footer className="sticky bottom-0 z-20 flex shrink-0 items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/90 px-6 py-4 backdrop-blur-md">
                {footer}
              </footer>
            ) : null}
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
};

export default FloatingModal;
