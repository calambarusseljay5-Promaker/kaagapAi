export function showAdminSystemToast(arg1, arg2, arg3) {
  if (typeof window === "undefined") return;

  if (!arg1) {
    window.dispatchEvent(new CustomEvent("admin_system_toast", { detail: null }));
    return;
  }

  let type = "success";
  let text = "";
  let title = "";

  if (typeof arg1 === "string") {
    text = arg1;
    type = arg2 || "success";
    title = arg3 || (type === "error" ? "System Error" : "System Notification");
  } else if (typeof arg1 === "object") {
    type = arg1.type || "success";
    text = arg1.text || arg1.message || "";
    title = arg1.title || (type === "error" ? "System Error" : "System Notification");
  }

  if (!text) return;

  window.dispatchEvent(
    new CustomEvent("admin_system_toast", {
      detail: {
        type,
        text,
        title,
        timestamp: Date.now(),
      },
    })
  );
}
