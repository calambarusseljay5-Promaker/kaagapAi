import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Trash2,
  X,
  Loader2,
  ShieldAlert,
} from "lucide-react";

/**
 * Compact, Minimized Reusable Confirmation Modal Component
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
  customIcon: CustomIcon = null,
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

  const isDanger = variant === "danger" || variant === "destructive";
  const isWarning = variant === "warning";

  const getHeaderIcon = () => {
    if (CustomIcon) return <CustomIcon size={18} />;
    if (isDanger) return <Trash2 size={18} />;
    if (isWarning) return <AlertTriangle size={18} />;
    return <CheckCircle2 size={18} />;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-0"
          />

          {/* Compact Dialog Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            style={{ maxWidth: 340, width: "90%" }}
            className="relative z-10 mx-auto bg-white rounded-2xl shadow-2xl border border-emerald-500/20 overflow-hidden flex flex-col p-4 text-center space-y-3"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              disabled={loading}
              className="absolute top-2.5 right-2.5 h-6 w-6 rounded-full bg-slate-100 text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center transition disabled:opacity-50 cursor-pointer"
            >
              <X size={13} />
            </button>

            {/* Icon Header */}
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl shadow-xs shrink-0 mt-1">
              {isDanger ? (
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600 border border-rose-200">
                  {getHeaderIcon()}
                </span>
              ) : isWarning ? (
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 border border-amber-200">
                  {getHeaderIcon()}
                </span>
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00552E] text-white shadow-xs">
                  {getHeaderIcon()}
                </span>
              )}
            </div>

            {/* Title & Message */}
            <div className="space-y-1 px-1">
              <h3 className="text-sm font-black text-slate-900 leading-tight">
                {title}
              </h3>
              <p className="text-xs font-medium text-slate-600 leading-relaxed">
                {message}
              </p>
            </div>

            {/* Action Buttons (Compact) */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="h-8 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
              >
                {cancelText}
              </button>

              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                className={`h-8 rounded-lg text-xs font-bold text-white shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  isDanger
                    ? "bg-rose-600 hover:bg-rose-700 active:scale-98"
                    : isWarning
                    ? "bg-amber-600 hover:bg-amber-700 active:scale-98"
                    : "bg-[#00552E] hover:bg-[#004224] active:scale-98"
                }`}
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : null}
                <span>{confirmText}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmationModal;
