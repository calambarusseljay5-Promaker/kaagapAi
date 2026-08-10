import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Trash2,
  X,
  Loader2,
  LogOut,
  ShieldAlert,
  Save,
  RotateCcw,
  UserCheck,
  UserX,
  FileCheck2,
  FileX
} from "lucide-react";

/**
 * Professional Reusable Confirmation Modal Component
 * 
 * Fits KaagapAI Branding:
 * - Official Barangay Upper Mingading Seal (/logo.png)
 * - Modern Glassmorphism (white dominant + emerald accents)
 * - Rounded corners (rounded-3xl)
 * - Red for destructive actions (danger/delete)
 * - Emerald Green for positive actions (create/save/approve/restore)
 * - Keyboard accessibility (Escape to close, Enter to confirm)
 */
const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed with this action?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "emerald", // "emerald" | "danger" | "warning"
  loading = false,
  customIcon: CustomIcon = null
}) => {

  // Keyboard accessibility
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "Enter" && !loading) {
        event.preventDefault();
        onConfirm();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, loading, onClose, onConfirm]);

  if (!isOpen) return null;

  // Determine icon & theme colors based on variant
  const isDanger = variant === "danger" || variant === "destructive";
  const isWarning = variant === "warning";

  const getHeaderIcon = () => {
    if (CustomIcon) return <CustomIcon size={24} />;
    if (isDanger) return <Trash2 size={24} />;
    if (isWarning) return <AlertTriangle size={24} />;
    return <CheckCircle2 size={24} />;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop (Clicking backdrop closes modal, does NOT confirm) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-0"
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 15 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative z-10 w-full max-w-[310px] sm:max-w-md bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col p-4 sm:p-7 text-center space-y-3.5 sm:space-y-5"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              disabled={loading}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center transition duration-150 disabled:opacity-50"
            >
              <X size={15} />
            </button>

            {/* BRANDING HEADER WITH BARANGAY LOGO */}
            <div className="flex flex-col items-center space-y-1.5 sm:space-y-2">
              <div className="relative">
                {/* Outer Glow */}
                <div className={`h-12 w-12 sm:h-16 sm:w-16 rounded-2xl sm:rounded-3xl flex items-center justify-center border shadow-md ${
                  isDanger
                    ? "bg-rose-50 border-rose-200 text-rose-600"
                    : isWarning
                    ? "bg-amber-50 border-amber-200 text-amber-600"
                    : "bg-emerald-50 border-emerald-200 text-[#0B5D3B]"
                }`}>
                  {getHeaderIcon()}
                </div>

                {/* Mini Barangay Seal Badge */}
                <div className="absolute -bottom-1 -right-1 h-5 w-5 sm:h-7 sm:w-7 rounded-full bg-white p-0.5 border border-slate-200 shadow-md flex items-center justify-center overflow-hidden">
                  <img src="/logo.png" alt="Barangay Seal" className="h-full w-full object-contain" />
                </div>
              </div>

              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-400">
                KaagapAI System
              </span>
            </div>

            {/* TITLE & MESSAGE */}
            <div className="space-y-1">
              <h3 className="text-base sm:text-xl font-black text-slate-900 leading-tight">
                {title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 font-semibold leading-relaxed px-1">
                {message}
              </p>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex items-center gap-2.5 sm:gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold text-slate-700 transition active:scale-95 disabled:opacity-50"
              >
                {cancelText}
              </button>

              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                className={`flex-1 rounded-xl sm:rounded-2xl py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold text-white shadow-md transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 ${
                  isDanger
                    ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20"
                    : isWarning
                    ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"
                    : "bg-[#0B5D3B] hover:bg-[#09482e] shadow-emerald-900/20"
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>{confirmText}</span>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmationModal;
