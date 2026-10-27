import { useEffect, useMemo, useState } from "react";
import {
  Download,
  ExternalLink,
  Eye,
  FileText,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
  FileX,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

export default function ProofViewerModal({
  isOpen,
  onClose,
  request,
  onOpenStudio,
}) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setImageError(false);
      const handleKeyDown = (e) => {
        if (e.key === "Escape") onClose();
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  const rawUrl = request?.attachment_url || "";
  const attachmentName = request?.attachment_name || "proof-attachment";
  const residentName =
    request?.residents?.full_name ||
    request?.full_name ||
    "Resident";
  const purok = request?.residents?.purok || "";
  const documentType = request?.document_type || "Document Request";
  const purpose = request?.purpose || "";
  const status = request?.status || "Pending";

  const resolvedUrl = useMemo(() => {
    if (!rawUrl) return "";
    if (
      rawUrl.startsWith("http://") ||
      rawUrl.startsWith("https://") ||
      rawUrl.startsWith("data:") ||
      rawUrl.startsWith("blob:")
    ) {
      return rawUrl;
    }
    // Storage path resolution
    const cleanPath = rawUrl.replace(/^resident-registration-proofs\//, "");
    const { data } = supabase.storage
      .from("resident-registration-proofs")
      .getPublicUrl(cleanPath);
    return data?.publicUrl || rawUrl;
  }, [rawUrl]);

  if (!isOpen || !request) return null;

  const isDataUrl = resolvedUrl.startsWith("data:");
  const isImage =
    resolvedUrl.startsWith("data:image/") ||
    /\.(png|jpe?g|webp|gif|svg)($|\?)/i.test(resolvedUrl) ||
    (isDataUrl && !resolvedUrl.startsWith("data:application/pdf")) ||
    (!resolvedUrl.toLowerCase().includes(".pdf") && !resolvedUrl.startsWith("data:application/pdf"));

  const isPdf =
    resolvedUrl.startsWith("data:application/pdf") ||
    /\.pdf($|\?)/i.test(resolvedUrl);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const handleDownload = () => {
    if (!resolvedUrl) return;
    const a = document.createElement("a");
    a.href = resolvedUrl;
    a.download = attachmentName || `Proof-${residentName.replace(/\s+/g, "_")}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenNewTab = () => {
    if (!resolvedUrl) return;
    if (isDataUrl) {
      const win = window.open();
      if (win) {
        if (isPdf) {
          win.document.write(
            `<iframe src="${resolvedUrl}" frameborder="0" style="border:0; top:0; left:0; bottom:0; right:0; width:100%; height:100%;" allowfullscreen></iframe>`
          );
        } else {
          win.document.write(
            `<html><head><title>${attachmentName}</title></head><body style="margin:0; background:#0f172a; display:flex; align-items:center; justify-content:center; min-height:100vh;"><img src="${resolvedUrl}" style="max-width:100%; max-height:100vh; object-fit:contain; box-shadow:0 10px 30px rgba(0,0,0,0.5);" /></body></html>`
          );
        }
      }
    } else {
      window.open(resolvedUrl, "_blank", "noopener,noreferrer");
    }
  };

  const formatDate = (iso) => {
    if (!iso) return "N/A";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "N/A";
      return d.toLocaleString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return "N/A";
    }
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-slate-950/75 p-3 sm:p-5 backdrop-blur-md animate-fadeIn">
      <div
        className="relative flex flex-col w-full max-w-4xl max-h-[92vh] rounded-3xl bg-white shadow-2xl border border-slate-200/80 overflow-hidden text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-[#0b291a] px-5 py-3.5 text-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-xs">
              <ShieldCheck size={20} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">
                Official Document Verification
              </span>
              <h2 className="text-sm sm:text-base font-black truncate text-white leading-tight">
                Request Attachments & Valid ID
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {resolvedUrl && (
              <>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-bold text-slate-200 transition border border-slate-700 cursor-pointer shadow-xs"
                  title="Download File"
                >
                  <Download size={14} />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenNewTab}
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-bold text-slate-200 transition border border-slate-700 cursor-pointer shadow-xs"
                  title="Open in new window"
                >
                  <ExternalLink size={14} />
                  <span>Full Screen</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white border border-slate-700 transition cursor-pointer shadow-xs"
              aria-label="Close modal"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Metadata Details Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 border-b border-slate-200/80 bg-slate-50/90 px-5 py-3 text-xs">
          <div className="min-w-0">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Resident
            </span>
            <span className="font-black text-slate-900 truncate block text-sm">
              {residentName}
            </span>
            {purok && (
              <span className="text-[11px] font-semibold text-emerald-700 block truncate">
                Purok: {purok}
              </span>
            )}
          </div>

          <div className="min-w-0 sm:col-span-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Document Requested
            </span>
            <span className="font-bold text-slate-800 truncate block text-xs">
              {documentType}
            </span>
            {purpose && (
              <span className="text-[11px] font-medium text-slate-600 block truncate mt-0.5">
                Purpose: <b className="text-slate-800 font-semibold">{purpose}</b>
              </span>
            )}
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block sm:text-right">
                Status
              </span>
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide border ${
                status === "Completed" || status === "Released"
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                  : status === "Processing"
                  ? "bg-blue-100 text-blue-800 border-blue-300"
                  : "bg-amber-100 text-amber-800 border-amber-300"
              }`}>
                {status}
              </span>
            </div>
          </div>
        </div>

        {/* File Name & Viewer Controls Toolbar */}
        {resolvedUrl && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-5 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileText size={15} className="text-emerald-700 shrink-0" />
              <span className="text-xs font-semibold text-slate-700 truncate max-w-xs sm:max-w-md" title={attachmentName}>
                {attachmentName}
              </span>
            </div>

            {isImage && !imageError && (
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={zoom <= 0.5}
                  className="p-1 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition disabled:opacity-30 cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut size={15} />
                </button>
                <span className="px-1 text-[11px] font-bold text-slate-700 select-none min-w-[38px] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={zoom >= 3}
                  className="p-1 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition disabled:opacity-30 cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn size={15} />
                </button>
                <div className="w-px h-4 bg-slate-300 mx-0.5" />
                <button
                  type="button"
                  onClick={handleRotate}
                  className="p-1 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition cursor-pointer"
                  title="Rotate 90°"
                >
                  <RotateCw size={15} />
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-white hover:text-slate-900 rounded-lg transition cursor-pointer"
                  title="Reset Zoom & Rotation"
                >
                  Reset
                </button>
              </div>
            )}
          </div>
        )}

        {/* Modal Main Viewport */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-900/5 flex items-center justify-center min-h-[350px]">
          {resolvedUrl ? (
            isImage && !imageError ? (
              <div className="relative flex items-center justify-center w-full h-full min-h-[320px] overflow-auto">
                <img
                  src={resolvedUrl}
                  alt={attachmentName}
                  onError={() => setImageError(true)}
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    transition: "transform 0.15s ease-out",
                    maxHeight: "58vh",
                  }}
                  className="object-contain rounded-xl shadow-lg border border-slate-200 bg-white"
                />
              </div>
            ) : isPdf ? (
              <div className="w-full h-[58vh] rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-md flex flex-col">
                <iframe
                  src={resolvedUrl}
                  title={attachmentName}
                  className="w-full h-full border-0"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl bg-white border border-slate-200 shadow-sm max-w-md">
                <FileText size={48} className="text-emerald-600 mb-3" />
                <h3 className="text-sm font-bold text-slate-900 mb-1">
                  Attached Supporting Document
                </h3>
                <p className="text-xs text-slate-500 mb-4 truncate max-w-full">
                  {attachmentName}
                </p>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  <Download size={15} />
                  <span>Download Attachment</span>
                </button>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl bg-white border border-slate-200 shadow-sm max-w-md">
              <div className="h-14 w-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mb-3">
                <FileX size={28} />
              </div>
              <h3 className="text-sm font-black text-slate-900 mb-1">
                No Attachments or Valid ID Uploaded
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xs mb-3">
                This document request does not have an attached ID or supporting document. It may have been created before the upload requirement was added, or encoded as an in-person walk-in request.
              </p>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3">
          <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
            <Clock size={13} className="text-slate-400" />
            Requested: <b className="text-slate-800 font-bold">{formatDate(request.created_at)}</b>
          </p>

          <div className="flex items-center gap-2 ml-auto">
            {onOpenStudio && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenStudio(request);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <Eye size={15} />
                <span>Open in Document Studio</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 hover:bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
