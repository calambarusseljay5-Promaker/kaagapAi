import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import ConfirmationModal from "../components/ConfirmationModal";

const ConfirmContext = createContext(null);

export const ConfirmProvider = ({ children }) => {
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    variant: "emerald",
    loading: false,
    customIcon: null
  });

  const resolverRef = useRef(null);

  /**
   * Promisified confirmation dialog trigger
   * Usage:
   *   const ok = await confirm({
   *     title: "Confirm Logout",
   *     message: "Are you sure you want to log out?",
   *     confirmText: "Logout",
   *     variant: "danger"
   *   });
   *   if (!ok) return;
   */
  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setModalState({
        isOpen: true,
        title: options.title || "Confirm Action",
        message: options.message || "Are you sure you want to proceed with this action?",
        confirmText: options.confirmText || "Confirm",
        cancelText: options.cancelText || "Cancel",
        variant: options.variant || (options.isDestructive ? "danger" : "emerald"),
        loading: false,
        customIcon: options.customIcon || options.icon || null
      });
    });
  }, []);

  const handleClose = () => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  };

  const handleConfirm = () => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ConfirmationModal
        isOpen={modalState.isOpen}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title={modalState.title}
        message={modalState.message}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        variant={modalState.variant}
        loading={modalState.loading}
        customIcon={modalState.customIcon}
      />
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context;
};
