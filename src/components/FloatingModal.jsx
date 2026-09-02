import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useBarangayLogo } from "../services/logoService";

const widthMap = {
  "max-w-sm": "384px",
  "max-w-md": "480px",
  "max-w-lg": "560px",
  "max-w-xl": "640px",
  "max-w-2xl": "720px",
  "max-w-3xl": "840px",
  "max-w-4xl": "960px",
};

const FloatingModal = ({
  open,
  isOpen,
  title,
  eyebrow = "KaagapAI System",
  description,
  onClose,
  children,
  footer,
  maxWidth = "max-w-3xl",
  closeOnBackdropClick = true,
}) => {
  const isModalOpen = Boolean(open ?? isOpen);
  const resolvedMaxWidth = widthMap[maxWidth] || (maxWidth.includes("px") || maxWidth.includes("rem") ? maxWidth : undefined);
  const barangayLogo = useBarangayLogo();

  useEffect(() => {
    if (!isModalOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen, onClose]);

  if (!isModalOpen || typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isModalOpen && (
        <div className="fixed inset-0 z-[999998] flex items-center justify-center p-3 sm:p-4 overflow-hidden pointer-events-auto">
          {/* Light Glassmorphism Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeOnBackdropClick ? onClose : undefined}
            className="fixed inset-0 bg-slate-950/45 backdrop-blur-md z-0"
          />

          {/* Centered Floating Modal Window */}
          <motion.section
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{ maxWidth: resolvedMaxWidth }}
            className={`relative z-10 flex max-h-[88vh] w-full flex-col overflow-hidden rounded-3xl border border-white/80 bg-white/95 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] backdrop-blur-2xl text-slate-900`}
          >
            {/* Sticky Modal Header - Sleek Dark Green */}
            <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 border-b border-emerald-400/30 bg-gradient-to-r from-[#033E2A] via-[#045438] to-[#03442E] text-white px-4 sm:px-6 py-3 sm:py-4 shadow-md relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-transparent pointer-events-none" />
              <div className="flex items-center gap-2.5 relative z-10 min-w-0">
                <img src={barangayLogo || "/logo.png"} alt="Seal" className="h-9 w-9 sm:h-10 sm:w-10 object-contain drop-shadow-md shrink-0" />
                <div className="min-w-0">
                  {eyebrow ? (
                    <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-emerald-200 truncate">
                      {eyebrow}
                    </p>
                  ) : null}
                  <h2 className="text-sm sm:text-base font-black text-white leading-snug drop-shadow-sm truncate">{title}</h2>
                  {description ? (
                    <p className="mt-0.5 text-[10px] sm:text-xs font-medium text-emerald-100/90 truncate">{description}</p>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="relative z-10 flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-black/40 hover:bg-rose-600 border border-white/40 text-white hover:border-rose-400 transition shadow-md active:scale-95 cursor-pointer"
                aria-label="Close modal"
                title="Close modal"
              >
                <X size={16} className="text-white stroke-[2.5]" />
              </button>
            </header>

            {/* Scrollable Modal Content */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 custom-scrollbar space-y-4 text-slate-900">
              {children}
            </div>

            {/* Sticky Modal Footer */}
            {footer ? (
              <footer className="sticky bottom-0 z-20 flex shrink-0 items-center justify-end gap-3 border-t border-slate-200/80 bg-slate-50/90 px-6 py-4 backdrop-blur-md">
                {footer}
              </footer>
            ) : null}
          </motion.section>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default FloatingModal;
