import { useCallback, useState } from "react";
import { createSafetyBackup } from "../services/backupService";

/**
 * Custom hook that provides a safety backup wrapper for destructive actions.
 *
 * Usage:
 *   const { withSafetyBackup, isBacking } = useBackupSafety();
 *
 *   const handleDelete = async (resident) => {
 *     await withSafetyBackup("Before Delete Resident", async () => {
 *       await deleteResident(resident);
 *     });
 *   };
 *
 * The safety backup runs silently before the action. If the backup fails,
 * the destructive action still proceeds (non-blocking).
 */
export function useBackupSafety() {
  const [isBacking, setIsBacking] = useState(false);

  /**
   * Wrap a destructive async function with a safety backup.
   * @param {string} actionLabel - e.g., "Before Delete Resident"
   * @param {() => Promise<*>} asyncFn - The destructive async function to execute.
   * @returns {Promise<*>} The result of asyncFn.
   */
  const withSafetyBackup = useCallback(async (actionLabel, asyncFn) => {
    setIsBacking(true);

    // Attempt safety backup (non-blocking on failure)
    try {
      await createSafetyBackup(actionLabel);
    } catch (backupError) {
      console.warn(`Safety backup failed for "${actionLabel}":`, backupError.message);
      // Continue with the action even if backup fails
    } finally {
      setIsBacking(false);
    }

    // Execute the actual destructive action
    return asyncFn();
  }, []);

  return {
    withSafetyBackup,
    isBacking,
  };
}

export default useBackupSafety;
