import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Save,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Sparkles,
  ChevronDown,
  Info,
  RotateCcw,
  Check,
  FileText,
  Printer,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Image as ImageIcon,
  Sliders,
  Upload,
  Eye,
  EyeOff,
  Move,
  ArrowLeft,
  Plus,
  Minus,
  Undo2,
  Redo2,
  Scissors,
  Copy,
  Clipboard,
  Calendar,
  Trash2,
  List,
  ListOrdered,
} from "lucide-react";
import {
  AVAILABLE_PLACEHOLDERS,
  TEMPLATE_CATEGORIES,
} from "../../services/documentTemplateService";
import {
  getRealDocumentTemplateKey,
  BARANGAY_SEAL_SRC,
  PUNONG_BARANGAY,
  REAL_DOCUMENT_CSS,
} from "../../utils/realDocumentTemplates";

export default function TemplateEditorModal({
  isOpen,
  onClose,
  template,
  onSave,
  saving = false,
}) {
  const [formData, setFormData] = useState({
    template_name: "",
    category: "Certification",
    description: "",
    status: "Active",
    content: "",
  });

  // Dropdown / Popover states
  const [fieldMenuOpen, setFieldMenuOpen] = useState(false);
  const [logoMenuOpen, setLogoMenuOpen] = useState(false);
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);

  // Selected On-Canvas Object for live manipulation ('logo' | 'secondaryLogo' | null)
  const [selectedCanvasObject, setSelectedCanvasObject] = useState(null);

  // Zoom & View Scaling Controls (default 100%)
  const [zoom, setZoom] = useState(100);

  // Typography & Spacing Controls
  const [fontFamily, setFontFamily] = useState("times");
  const [fontSize, setFontSize] = useState("12");
  const [lineHeight, setLineHeight] = useState("1.25");

  // Word & Character count metrics
  const [docStats, setDocStats] = useState({ words: 0, characters: 0 });

  // Logo Customization & Realignment State
  const [logoConfig, setLogoConfig] = useState({
    url: BARANGAY_SEAL_SRC,
    alignment: "left", // 'left' | 'center' | 'right' | 'dual'
    size: 110, // in pixels (matches 1.18in standard)
    offsetX: 0, // in pixels
    offsetY: 0, // in pixels
    visible: true,
    secondaryUrl: "/aleosan.logo.png",
    secondarySize: 110,
    secondaryOffsetX: 0,
    secondaryOffsetY: 0,
    secondaryVisible: false,
  });

  // Fully Editable Header & Structure State
  const [headerConfig, setHeaderConfig] = useState({
    country: "Republic of the Philippines",
    province: "Province of Cotabato",
    municipality: "Municipality of Aleosan",
    barangay: "Barangay of Upper Mingading",
    office: "OFFICE OF THE PUNONG BARANGAY",
    title: "BARANGAY CLEARANCE",
    salutation: "TO WHOM IT MAY CONCERN:",
    captainName: PUNONG_BARANGAY,
    captainTitle: "Punong Barangay",
    showOrSection: true,
    sealNote: "Brgy. Seal/25",
  });

  // Refs
  const headerEditorRef = useRef(null);
  const bodyEditorRef = useRef(null);
  const logoFileInputRef = useRef(null);
  const secondaryLogoFileInputRef = useRef(null);

  // Preset Seals
  const PRESET_LOGOS = [
    { id: "brgy", name: "Upper Mingading Seal", url: "/logo.png" },
    { id: "aleosan", name: "Aleosan Municipal Seal", url: "/aleosan.logo.png" },
    {
      id: "ph",
      name: "Philippine National Seal",
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Coat_of_arms_of_the_Philippines.svg/512px-Coat_of_arms_of_the_Philippines.svg.png",
    },
  ];

  // Helper to get default template body text
  const getDefaultContentForKey = (key) => {
    if (key === "clearance") {
      return `<p>This is to certify according to our existing records that Ms./<u>Mr</u>/Mrs. <strong>{{FULL_NAME}}</strong>, <strong>{{AGE}}</strong> yrs. Old, Filipino {{CIVIL_STATUS}}, whose signature and thumbmark appear below is presently a resident of Purok {{PUROK}}, Upper Mingading, Aleosan, Cotabato and no current position in the Barangay.</p><p>This is to certify further, that their character, reputation and moral standing in the community are beyond reproach and that as of the date of this issued there is no pending case whatsoever filed against the above – named person for whatever any legal purpose which may serve them best.</p><p>This is to certify further more that in view of the foregoing circumstances, this Barangay Clearance is issued upon request of the above – named person for <strong>{{PURPOSE}}</strong> and whatever any legal purpose which may serve them best.</p><p>Issued this <u>{{DAY}}</u> day of <u>{{MONTH}} {{YEAR}}</u> at Barangay Upper Mingading, Aleosan, Cotabato.</p>`;
    }
    if (key === "residency") {
      return `<p>THIS IS TO CERTIFY that <strong>{{FULL_NAME}}</strong>, <u>male</u>/ female, single/ <u>married</u>, Filipino, was born on {{BIRTHDAY}} a bona fide citizen of Purok {{PUROK}}, Upper Mingading, Aleosan, Cotabato. <u>His</u>/ Her, reputation and moral standing in the community is beyond reproach and that is no pending case filed on said person whatsoever. From our barangay peace and order committee we are recommending him <u>{{PURPOSE}}</u>.</p><p>This certification is issued upon the request of above-named person for whatever legal purpose it may serve best.</p><p>Issued this <u>{{DAY}}</u> day of <u>{{MONTH}} {{YEAR}}</u> at Barangay Upper Mingading, Aleosan, Cotabato.</p>`;
    }
    if (key === "indigency") {
      return `<p>THIS IS TO CERTIFY that <strong>{{FULL_NAME}}</strong>, <strong>{{AGE}}</strong> yrs. old single/ married/ Widow and a bonafide resident of Purok {{PUROK}}, Upper Mingading, Aleosan, Cotabato a low income earner family and considered as indigent.</p><p>This certification is issued upon the request of above-named person for <strong>{{PURPOSE}}</strong> and for whatever legal purpose it may serve best.</p><p>Issued this <u>{{DAY}}</u> day of <u>{{MONTH}} {{YEAR}}</u> at Barangay Upper Mingading, Aleosan, Cotabato.</p>`;
    }
    if (key === "business") {
      return `<p>This is to certify that <strong>{{FULL_NAME}}</strong>, <strong>{{AGE}}</strong> yrs. old, Filipino, {{CIVIL_STATUS}}, a bona fide resident of Purok {{PUROK}}, Barangay Upper Mingading, Aleosan, Cotabato, and they have a <strong>{{BUSINESS_NAME}}</strong> at the said place.</p><p>This certification is being issued upon the request of the above-mentioned name person for Business Permit Application and for whatever any legal purposes may serve them best.</p><p>Issued this <u>{{DAY}}</u> day of <u>{{MONTH}} {{YEAR}}</u> at Barangay Upper Mingading, Aleosan, Cotabato.</p>`;
    }
    if (key === "solo") {
      return `<p>This is to certify that <strong>{{FULL_NAME}}</strong> legal age, Filipino, {{CIVIL_STATUS}}, a bona fide resident of Purok {{PUROK}}, Barangay Upper Mingading, Aleosan, Cotabato.</p><p>This certification is being issued upon the request of the above-mentioned name person on application for solo parent due to <strong>{{SOLO_PARENT_REASON}}</strong> and whatever any legal intent may serve best.</p><p>Issued this <u>{{DAY}}</u> day of <u>{{MONTH}} {{YEAR}}</u> at Barangay Upper Mingading, Aleosan, Cotabato.</p>`;
    }
    if (key === "4ps") {
      return `<p>This is to certify that <strong>{{FULL_NAME}}</strong>, <strong>{{AGE}}</strong> yrs. old, Filipino, {{CIVIL_STATUS}}, a bona fide resident of Purok {{PUROK}}, Barangay Upper Mingading, Aleosan, Cotabato.</p><p>This certification is being issued upon the request of the above-mentioned name person for <strong>{{PURPOSE}}</strong> and for whatever any legal purposes.</p><p>Issued this <u>{{DAY}}</u> day <u>of {{MONTH}}</u> <strong>{{YEAR}}</strong> at Barangay Upper Mingading, Aleosan, Cotabato.</p>`;
    }
    if (key === "rsbsa") {
      return `<p>THIS IS TO CERTIFY THAT <strong>{{FULL_NAME}}</strong> <strong>{{AGE}}</strong> y/o, residing at {{ADDRESS}}, Upper Mingading Aleosan, Cotabato, is tilling the following crop(s) <strong>{{CROPS_DETAILS}}</strong> as <u>Owner</u>/Farmer at Purok {{PUROK}}, Upper Mingading, Cotabato with size {{FARM_SIZE}}.</p><p>This <strong>CERTIFICATION</strong> is being issued by the Barangay solely for the purpose of the farmers and fisher folk registration to the <strong>REGISTRY SYSTEM FOR BASIC SECTORS IN AGRICULTURE (RSBSA)</strong> of the Department of Agriculture and may not be used for other purposes not mention above.</p>`;
    }
    return `<p>This is to certify that <strong>{{FULL_NAME}}</strong>, <strong>{{AGE}}</strong> yrs. old, Filipino, {{CIVIL_STATUS}}, a bona fide resident of Purok {{PUROK}}, Barangay Upper Mingading, Aleosan, Cotabato.</p><p>This certification is issued for <strong>{{PURPOSE}}</strong> and whatever legal purpose it may serve best.</p><p>Issued this <u>{{DAY}}</u> day of <u>{{MONTH}} {{YEAR}}</u> at Barangay Upper Mingading, Aleosan, Cotabato.</p>`;
  };

  // Strip any accidental <img> tags from the text container to prevent duplication
  const sanitizeTextHtml = (html) => {
    if (!html) return "";
    return html.replace(/<img[^>]*>/gi, "");
  };

  // Update live word & character statistics
  const updateMetrics = () => {
    const headerText = headerEditorRef.current?.innerText || "";
    const bodyText = bodyEditorRef.current?.innerText || "";
    const combined = `${headerText} ${bodyText}`.trim();
    const words = combined ? combined.split(/\s+/).length : 0;
    setDocStats({
      words,
      characters: combined.length,
    });
  };

  useEffect(() => {
    if (!isOpen) return;

    const tplName = template?.template_name || template?.document_type || "Barangay Clearance";
    const key = getRealDocumentTemplateKey(tplName);
    const isKnownCategory = TEMPLATE_CATEGORIES.includes(template?.category);

    if (key === "residency" || key === "indigency" || key === "business" || key === "rsbsa" || key === "4ps") {
      setFontFamily("rockwell");
      setFontSize("14");
    } else {
      setFontFamily("times");
      setFontSize("12");
    }

    const initialBody = sanitizeTextHtml(template?.content || getDefaultContentForKey(key));
    const officialDocTitle = key === "clearance" ? "BARANGAY CLEARANCE" : "CERTIFICATION";

    // Load any saved custom header / logo configs if available
    const savedConfig = template?.header_config || {};

    const loadedLogoConfig = {
      url: savedConfig.logoUrl || BARANGAY_SEAL_SRC,
      alignment: savedConfig.logoAlignment || "left",
      size: Number(savedConfig.logoSize) || 110,
      offsetX: Number(savedConfig.logoOffsetX) || 0,
      offsetY: Number(savedConfig.logoOffsetY) || 0,
      visible: savedConfig.showLogo !== false,
      secondaryUrl: savedConfig.secondaryUrl || "/aleosan.logo.png",
      secondarySize: Number(savedConfig.secondarySize) || 110,
      secondaryOffsetX: Number(savedConfig.secondaryOffsetX) || 0,
      secondaryOffsetY: Number(savedConfig.secondaryOffsetY) || 0,
      secondaryVisible: Boolean(savedConfig.secondaryVisible) || savedConfig.logoAlignment === "dual",
    };

    const loadedHeaderConfig = {
      country: savedConfig.country || "Republic of the Philippines",
      province: savedConfig.province || "Province of Cotabato",
      municipality: savedConfig.municipality || "Municipality of Aleosan",
      barangay: savedConfig.barangay || "Barangay of Upper Mingading",
      office: savedConfig.office || "OFFICE OF THE PUNONG BARANGAY",
      title: savedConfig.title || officialDocTitle,
      salutation: savedConfig.salutation || "TO WHOM IT MAY CONCERN:",
      captainName: savedConfig.captainName || PUNONG_BARANGAY,
      captainTitle: savedConfig.captainTitle || "Punong Barangay",
      showOrSection: savedConfig.showOrSection !== false && key !== "solo",
      sealNote: savedConfig.sealNote || "Brgy. Seal/25",
    };

    setLogoConfig(loadedLogoConfig);
    setHeaderConfig(loadedHeaderConfig);

    setFormData({
      template_name: tplName,
      category: isKnownCategory ? template.category : "Certification",
      description: template?.description || "Official barangay document template.",
      status: template?.status || "Active",
      content: initialBody,
    });

    setTimeout(() => {
      if (bodyEditorRef.current) {
        bodyEditorRef.current.innerHTML = initialBody;
      }
      updateMetrics();
    }, 50);
  }, [template, isOpen]);

  // Global Keyboard Shortcuts (Ctrl+A, Ctrl+B, Ctrl+I, Ctrl+U, Ctrl+S, Ctrl+Z, Ctrl+Y, Ctrl+P)
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        return;
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (isCtrlOrCmd && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSubmit(e);
      } else if (isCtrlOrCmd && e.key.toLowerCase() === "b") {
        e.preventDefault();
        executeCommand("bold");
      } else if (isCtrlOrCmd && e.key.toLowerCase() === "i") {
        e.preventDefault();
        executeCommand("italic");
      } else if (isCtrlOrCmd && e.key.toLowerCase() === "u") {
        e.preventDefault();
        executeCommand("underline");
      } else if (isCtrlOrCmd && e.key.toLowerCase() === "z") {
        e.preventDefault();
        executeCommand("undo");
      } else if (isCtrlOrCmd && e.key.toLowerCase() === "y") {
        e.preventDefault();
        executeCommand("redo");
      } else if (isCtrlOrCmd && e.key.toLowerCase() === "p") {
        e.preventDefault();
        handlePrintPreview();
      } else if (e.key === "Delete" && selectedCanvasObject) {
        e.preventDefault();
        handleCutLogo(selectedCanvasObject === "secondaryLogo");
      }
    };

    const handleGlobalPaste = (e) => {
      // Check if image is in clipboard
      if (e.clipboardData && e.clipboardData.items) {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
            e.preventDefault();
            const file = items[i].getAsFile();
            const reader = new FileReader();
            reader.onload = (event) => {
              setLogoConfig((prev) => ({
                ...prev,
                url: event.target.result,
                visible: true,
              }));
              setSelectedCanvasObject("logo");
            };
            reader.readAsDataURL(file);
            return;
          }
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    window.addEventListener("paste", handleGlobalPaste);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      window.removeEventListener("paste", handleGlobalPaste);
    };
  }, [isOpen, formData, selectedCanvasObject]);

  if (!isOpen) return null;

  // Zoom handlers
  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 15, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 15, 50));
  const handleZoomReset = () => setZoom(100);
  const handleZoomFit = () => setZoom(85);

  // Logo upload handlers
  const handleLogoUpload = (e, isSecondary = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (isSecondary) {
        setLogoConfig((prev) => ({
          ...prev,
          secondaryUrl: event.target.result,
          secondaryVisible: true,
        }));
        setSelectedCanvasObject("secondaryLogo");
      } else {
        setLogoConfig((prev) => ({
          ...prev,
          url: event.target.result,
          visible: true,
        }));
        setSelectedCanvasObject("logo");
      }
    };
    reader.readAsDataURL(file);
  };

  // Cut / Delete Logo
  const handleCutLogo = (isSecondary = false) => {
    if (isSecondary) {
      setLogoConfig((prev) => ({
        ...prev,
        secondaryVisible: false,
      }));
    } else {
      setLogoConfig((prev) => ({
        ...prev,
        visible: false,
      }));
    }
    setSelectedCanvasObject(null);
  };

  // Paste Logo from Clipboard via navigator API
  const handlePasteLogoFromClipboard = async (isSecondary = false) => {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          for (const type of item.types) {
            if (type.startsWith("image/")) {
              const blob = await item.getType(type);
              const reader = new FileReader();
              reader.onload = (event) => {
                if (isSecondary) {
                  setLogoConfig((prev) => ({
                    ...prev,
                    secondaryUrl: event.target.result,
                    secondaryVisible: true,
                  }));
                  setSelectedCanvasObject("secondaryLogo");
                } else {
                  setLogoConfig((prev) => ({
                    ...prev,
                    url: event.target.result,
                    visible: true,
                  }));
                  setSelectedCanvasObject("logo");
                }
              };
              reader.readAsDataURL(blob);
              return;
            }
          }
        }
      }
      alert("No image in clipboard. Please copy an image first, then press Ctrl+V to paste!");
    } catch (err) {
      console.warn("Clipboard access error:", err);
      alert("Please press Ctrl+V on your keyboard to paste the image directly onto the template.");
    }
  };

  const handleEditorInput = () => {
    updateMetrics();
  };

  const executeCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    handleEditorInput();
  };

  const handleReset = () => {
    const key = getRealDocumentTemplateKey(formData.template_name);
    const defaultText = getDefaultContentForKey(key);
    const officialDocTitle = key === "clearance" ? "BARANGAY CLEARANCE" : "CERTIFICATION";

    const defaultHeader = {
      country: "Republic of the Philippines",
      province: "Province of Cotabato",
      municipality: "Municipality of Aleosan",
      barangay: "Barangay of Upper Mingading",
      office: "OFFICE OF THE PUNONG BARANGAY",
      title: officialDocTitle,
      salutation: "TO WHOM IT MAY CONCERN:",
      captainName: PUNONG_BARANGAY,
      captainTitle: "Punong Barangay",
      showOrSection: key !== "solo",
      sealNote: "Brgy. Seal/25",
    };

    setLogoConfig({
      url: BARANGAY_SEAL_SRC,
      alignment: "left",
      size: 110,
      offsetX: 0,
      offsetY: 0,
      visible: true,
      secondaryUrl: "/aleosan.logo.png",
      secondarySize: 110,
      secondaryOffsetX: 0,
      secondaryOffsetY: 0,
      secondaryVisible: false,
    });

    setHeaderConfig(defaultHeader);
    setSelectedCanvasObject(null);

    if (bodyEditorRef.current) {
      bodyEditorRef.current.innerHTML = defaultText;
      updateMetrics();
    }
  };

  const handleInsertPlaceholder = (token) => {
    if (bodyEditorRef.current) {
      bodyEditorRef.current.focus();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(` ${token} `);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        document.execCommand("insertText", false, ` ${token} `);
      }
      handleEditorInput();
    }
    setFieldMenuOpen(false);
  };

  const handleInsertDate = () => {
    const today = new Date();
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const dateStr = `${today.getDate()} day of ${months[today.getMonth()]} ${today.getFullYear()}`;
    executeCommand("insertText", dateStr);
  };

  const handlePrintPreview = () => {
    window.print();
  };

  const handleSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!formData.template_name.trim()) return;

    const bodyHtml = bodyEditorRef.current ? bodyEditorRef.current.innerHTML : formData.content;

    const compiledHeaderConfig = {
      country: headerConfig.country,
      province: headerConfig.province,
      municipality: headerConfig.municipality,
      barangay: headerConfig.barangay,
      office: headerConfig.office,
      title: headerConfig.title,
      salutation: headerConfig.salutation,
      captainName: headerConfig.captainName,
      captainTitle: headerConfig.captainTitle,
      logoUrl: logoConfig.url,
      logoAlignment: logoConfig.alignment,
      logoSize: logoConfig.size,
      logoOffsetX: logoConfig.offsetX,
      logoOffsetY: logoConfig.offsetY,
      showLogo: logoConfig.visible,
      secondaryUrl: logoConfig.secondaryUrl,
      secondarySize: logoConfig.secondarySize,
      secondaryOffsetX: logoConfig.secondaryOffsetX,
      secondaryOffsetY: logoConfig.secondaryOffsetY,
      secondaryVisible: logoConfig.secondaryVisible || logoConfig.alignment === "dual",
      showOrSection: headerConfig.showOrSection,
      sealNote: headerConfig.sealNote,
      fontFamily,
      fontSize,
      lineHeight,
    };

    onSave({
      ...formData,
      content: sanitizeTextHtml(bodyHtml),
      header_config: compiledHeaderConfig,
    });
  };

  const docKey = getRealDocumentTemplateKey(formData.template_name);

  const fontMap = {
    rockwell: '"Rockwell Condensed", "Rockwell", "Tw Cen MT Condensed", "Arial Narrow", serif',
    times: '"Times New Roman", Times, "Liberation Serif", serif',
    arial: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
    georgia: 'Georgia, "Times New Roman", serif',
    felix: '"Felix Titling", "Felix-Titling", "Times New Roman", serif',
    cooper: '"Cooper Std Black", "Cooper Black", serif, sans-serif',
  };

  const isSolo = docKey === "solo";
  const isClearance = docKey === "clearance";
  const isResidency = docKey === "residency";
  const isIndigency = docKey === "indigency";
  const isRsbsa = docKey === "rsbsa";

  const modalMarkup = (
    <div className="fixed inset-0 z-[99999] w-screen h-screen bg-[#cbd5e1] flex flex-col overflow-hidden select-none animate-fadeIn">
      {/* Inject exact CSS from realDocumentTemplates */}
      <style>{REAL_DOCUMENT_CSS}</style>

      {/* ── 1. TOP APP BAR ── */}
      <header className="h-14 bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 px-4 sm:px-6 flex items-center justify-between text-white shrink-0 border-b border-emerald-800 shadow-md z-30">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition cursor-pointer active:scale-95 shrink-0 shadow-sm"
            title="Exit Document Studio"
          >
            <ArrowLeft size={15} className="text-emerald-300" />
            <span>Back to Templates</span>
          </button>

          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 shrink-0">
              <FileText size={16} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black text-white tracking-tight truncate">
                  {formData.template_name}
                </h1>
                <span className="hidden md:inline-block text-[10px] font-bold bg-emerald-700/80 px-2 py-0.5 rounded-full border border-emerald-500/40 text-emerald-100 shrink-0">
                  Official Document Studio
                </span>
              </div>
              <p className="text-[10px] font-medium text-emerald-300/80 truncate">
                Authentic Barangay Letterhead Format • Word-Style Text & Seal Controls
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handlePrintPreview}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition cursor-pointer active:scale-95 shrink-0"
            title="Print Preview (Ctrl + P)"
          >
            <Printer size={14} className="text-emerald-300" />
            <span className="hidden sm:inline">Print Preview</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md transition cursor-pointer active:scale-95 shrink-0"
            title="Exit Studio"
          >
            <X size={15} />
            <span>Exit</span>
          </button>
        </div>
      </header>

      {/* ── 2. MICROSOFT WORD RIBBON & COMPREHENSIVE TOOLBAR ── */}
      <div className="bg-white border-b border-slate-300 px-3 py-1.5 flex items-center justify-between gap-2 shrink-0 shadow-xs z-20 overflow-x-auto">
        <div className="flex items-center gap-1.5 shrink-0">
          {/* 1. Undo / Redo */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
            <button
              type="button"
              onClick={() => executeCommand("undo")}
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-white text-slate-700 hover:text-slate-900 transition cursor-pointer"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={13} />
            </button>
            <button
              type="button"
              onClick={() => executeCommand("redo")}
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-white text-slate-700 hover:text-slate-900 transition cursor-pointer"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 size={13} />
            </button>
          </div>

          {/* 2. Clipboard Tools */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
            <button
              type="button"
              onClick={() => executeCommand("cut")}
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-white text-slate-700 hover:text-slate-900 transition cursor-pointer"
              title="Cut Text (Ctrl+X)"
            >
              <Scissors size={13} />
            </button>
            <button
              type="button"
              onClick={() => executeCommand("copy")}
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-white text-slate-700 hover:text-slate-900 transition cursor-pointer"
              title="Copy Text (Ctrl+C)"
            >
              <Copy size={13} />
            </button>
            <button
              type="button"
              onClick={() => handlePasteLogoFromClipboard(false)}
              className="h-7 px-2 flex items-center gap-1 rounded-md hover:bg-white text-slate-700 hover:text-emerald-800 text-[11px] font-bold transition cursor-pointer"
              title="Paste Image or Logo from Clipboard (Ctrl+V)"
            >
              <Clipboard size={12} className="text-emerald-600" />
              <span>Paste Seal</span>
            </button>
          </div>

          <div className="h-5 w-px bg-slate-200 mx-0.5" />

          {/* 3. Font Family */}
          <select
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            className="h-8 rounded-lg border border-slate-300 bg-slate-50 px-2 text-xs font-bold text-slate-800 outline-none hover:bg-white focus:border-emerald-500 cursor-pointer shadow-2xs"
            title="Font Family"
          >
            <option value="times">Times New Roman (Standard)</option>
            <option value="rockwell">Rockwell Condensed (Official)</option>
            <option value="arial">Arial (Modern)</option>
            <option value="georgia">Georgia (Serif)</option>
            <option value="felix">Felix Titling (Certificates)</option>
            <option value="cooper">Cooper Std Black (Bold Display)</option>
          </select>

          {/* 4. Font Size */}
          <select
            value={fontSize}
            onChange={(e) => setFontSize(e.target.value)}
            className="h-8 rounded-lg border border-slate-300 bg-slate-50 px-2 text-xs font-bold text-slate-800 outline-none hover:bg-white focus:border-emerald-500 cursor-pointer shadow-2xs"
            title="Font Size"
          >
            <option value="10">10 pt</option>
            <option value="11">11 pt</option>
            <option value="12">12 pt (Clearance Standard)</option>
            <option value="13">13 pt</option>
            <option value="14">14 pt (Residency Standard)</option>
            <option value="15">15 pt</option>
            <option value="16">16 pt</option>
            <option value="18">18 pt</option>
          </select>

          {/* 5. Line Spacing */}
          <select
            value={lineHeight}
            onChange={(e) => setLineHeight(e.target.value)}
            className="h-8 rounded-lg border border-slate-300 bg-slate-50 px-2 text-xs font-bold text-slate-800 outline-none hover:bg-white focus:border-emerald-500 cursor-pointer shadow-2xs"
            title="Line Spacing"
          >
            <option value="1.15">1.15x Tight</option>
            <option value="1.25">1.25x Normal</option>
            <option value="1.35">1.35x Relaxed</option>
            <option value="1.5">1.50x 1.5 Lines</option>
            <option value="2.0">2.00x Double</option>
          </select>

          <div className="h-5 w-px bg-slate-200 mx-0.5" />

          {/* 6. Text Styles */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
            <button
              type="button"
              onClick={() => executeCommand("bold")}
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-white text-slate-800 font-black transition cursor-pointer shadow-2xs"
              title="Bold (Ctrl+B)"
            >
              <Bold size={13} className="stroke-[2.5]" />
            </button>
            <button
              type="button"
              onClick={() => executeCommand("italic")}
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-white text-slate-800 italic transition cursor-pointer shadow-2xs"
              title="Italic (Ctrl+I)"
            >
              <Italic size={13} className="stroke-[2.5]" />
            </button>
            <button
              type="button"
              onClick={() => executeCommand("underline")}
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-white text-slate-800 underline transition cursor-pointer shadow-2xs"
              title="Underline (Ctrl+U)"
            >
              <Underline size={13} className="stroke-[2.5]" />
            </button>
            <button
              type="button"
              onClick={() => executeCommand("strikeThrough")}
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-white text-slate-800 line-through transition cursor-pointer shadow-2xs"
              title="Strikethrough"
            >
              <Strikethrough size={13} />
            </button>
          </div>

          {/* 7. Alignments */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
            <button
              type="button"
              onClick={() => executeCommand("justifyLeft")}
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-white text-slate-800 transition cursor-pointer"
              title="Align Left"
            >
              <AlignLeft size={13} />
            </button>
            <button
              type="button"
              onClick={() => executeCommand("justifyCenter")}
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-white text-slate-800 transition cursor-pointer"
              title="Align Center"
            >
              <AlignCenter size={13} />
            </button>
            <button
              type="button"
              onClick={() => executeCommand("justifyRight")}
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-white text-slate-800 transition cursor-pointer"
              title="Align Right"
            >
              <AlignRight size={13} />
            </button>
            <button
              type="button"
              onClick={() => executeCommand("justifyFull")}
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-white text-slate-800 transition cursor-pointer"
              title="Justify"
            >
              <AlignJustify size={13} />
            </button>
          </div>

          {/* 8. Lists & Inserts */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
            <button
              type="button"
              onClick={() => executeCommand("insertUnorderedList")}
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-white text-slate-800 transition cursor-pointer"
              title="Bullet List"
            >
              <List size={13} />
            </button>
            <button
              type="button"
              onClick={() => executeCommand("insertOrderedList")}
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-white text-slate-800 transition cursor-pointer"
              title="Numbered List"
            >
              <ListOrdered size={13} />
            </button>
            <button
              type="button"
              onClick={handleInsertDate}
              className="h-7 px-1.5 flex items-center gap-1 rounded-md hover:bg-white text-slate-800 text-[10px] font-bold transition cursor-pointer"
              title="Insert Current Date"
            >
              <Calendar size={12} className="text-emerald-700" />
              <span>Date</span>
            </button>
          </div>

          <div className="h-5 w-px bg-slate-200 mx-0.5" />

          {/* 9. LOGO & SEALS STUDIO CONTROLS POPOVER */}
          <div className="relative inline-block">
            <button
              type="button"
              onClick={() => {
                setLogoMenuOpen(!logoMenuOpen);
                setZoomMenuOpen(false);
                setFieldMenuOpen(false);
              }}
              className={`h-8 px-3 flex items-center gap-1.5 rounded-lg border transition cursor-pointer shadow-2xs font-bold text-xs ${
                logoMenuOpen
                  ? "bg-emerald-600 text-white border-emerald-700 shadow-md"
                  : "border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900"
              }`}
              title="Logo Customization, Alignment, Upload & Pasting"
            >
              <ImageIcon size={14} className={logoMenuOpen ? "text-white" : "text-emerald-700"} />
              <span>Seal: {logoConfig.alignment.toUpperCase()} ({logoConfig.size}px)</span>
              <ChevronDown size={12} />
            </button>

            {logoMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setLogoMenuOpen(false)} />
                <div className="absolute left-0 top-9 z-50 w-96 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl space-y-3.5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <ImageIcon size={15} className="text-emerald-600" />
                      Official Seal Studio
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setLogoConfig((prev) => ({ ...prev, visible: !prev.visible }))
                      }
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 cursor-pointer transition ${
                        logoConfig.visible
                          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {logoConfig.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                      {logoConfig.visible ? "Visible" : "Hidden"}
                    </button>
                  </div>

                  {/* Preset Logos */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1.5">
                      Choose Preset Seal:
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {PRESET_LOGOS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setLogoConfig((prev) => ({
                              ...prev,
                              url: preset.url,
                              visible: true,
                            }));
                          }}
                          className={`p-1.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                            logoConfig.url === preset.url
                              ? "border-emerald-500 bg-emerald-50 text-emerald-900 font-bold shadow-xs"
                              : "border-slate-200 hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <img
                            src={preset.url}
                            alt={preset.name}
                            className="w-8 h-8 object-contain rounded-full border border-slate-200 bg-white"
                          />
                          <span className="text-[10px] leading-tight truncate w-full">{preset.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Alignment Options */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      Seal Position:
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { id: "left", label: "Left (Official)" },
                        { id: "center", label: "Center" },
                        { id: "right", label: "Right" },
                        { id: "dual", label: "Dual (Both)" },
                      ].map((align) => (
                        <button
                          key={align.id}
                          type="button"
                          onClick={() => {
                            setLogoConfig((prev) => ({
                              ...prev,
                              alignment: align.id,
                              secondaryVisible: align.id === "dual",
                            }));
                          }}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold transition text-center cursor-pointer ${
                            logoConfig.alignment === align.id
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                          }`}
                        >
                          {align.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Size Slider */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
                      <span>Seal Size:</span>
                      <span className="text-emerald-700 font-black">{logoConfig.size} px</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setLogoConfig((prev) => ({ ...prev, size: Math.max(prev.size - 5, 40) }))}
                        className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                      >
                        <Minus size={12} />
                      </button>
                      <input
                        type="range"
                        min="50"
                        max="180"
                        step="5"
                        value={logoConfig.size}
                        onChange={(e) =>
                          setLogoConfig((prev) => ({ ...prev, size: Number(e.target.value) }))
                        }
                        className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                      <button
                        type="button"
                        onClick={() => setLogoConfig((prev) => ({ ...prev, size: Math.min(prev.size + 5, 180) }))}
                        className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Offset Sliders */}
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-0.5">
                        <span>Horizontal Offset (X):</span>
                        <span className="text-slate-800 font-bold">{logoConfig.offsetX} px</span>
                      </div>
                      <input
                        type="range"
                        min="-60"
                        max="60"
                        step="2"
                        value={logoConfig.offsetX}
                        onChange={(e) => setLogoConfig((prev) => ({ ...prev, offsetX: Number(e.target.value) }))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-0.5">
                        <span>Vertical Offset (Y):</span>
                        <span className="text-slate-800 font-bold">{logoConfig.offsetY} px</span>
                      </div>
                      <input
                        type="range"
                        min="-40"
                        max="40"
                        step="2"
                        value={logoConfig.offsetY}
                        onChange={(e) => setLogoConfig((prev) => ({ ...prev, offsetY: Number(e.target.value) }))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>
                  </div>

                  {/* Upload / Paste / Cut */}
                  <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        ref={logoFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleLogoUpload(e, false)}
                      />
                      <button
                        type="button"
                        onClick={() => logoFileInputRef.current?.click()}
                        className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-emerald-400 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 text-xs font-bold transition cursor-pointer"
                      >
                        <Upload size={13} className="text-emerald-700" />
                        <span>Upload File</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePasteLogoFromClipboard(false)}
                        className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-sky-400 bg-sky-50 hover:bg-sky-100 text-sky-950 text-xs font-bold transition cursor-pointer"
                      >
                        <Clipboard size={13} className="text-sky-700" />
                        <span>Paste (Ctrl+V)</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCutLogo(false)}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl border border-red-200 hover:bg-red-50 text-red-700 text-xs font-bold transition cursor-pointer"
                    >
                      <Scissors size={12} />
                      <span>Cut / Remove Logo</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 10. Dynamic Placeholders */}
          <div className="relative inline-block shrink-0">
            <button
              type="button"
              onClick={() => {
                setFieldMenuOpen(!fieldMenuOpen);
                setLogoMenuOpen(false);
                setZoomMenuOpen(false);
              }}
              className="h-8 px-3 flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm transition cursor-pointer active:scale-95"
            >
              <Sparkles size={13} />
              <span>+ Insert Field</span>
              <ChevronDown size={12} />
            </button>

            {fieldMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setFieldMenuOpen(false)} />
                <div className="absolute left-0 top-9 z-50 w-76 max-h-84 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2.5 shadow-2xl space-y-2">
                  <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 flex items-center justify-between">
                    <span>Insert Dynamic Placeholder</span>
                    <span className="text-[9px] text-emerald-700 font-bold">Auto-fills</span>
                  </div>
                  {AVAILABLE_PLACEHOLDERS.map((group) => (
                    <div key={group.category} className="mb-1">
                      <div className="px-2 py-0.5 text-[10px] font-bold text-emerald-800 bg-emerald-50 rounded">
                        {group.category}
                      </div>
                      <div className="space-y-0.5 mt-1">
                        {group.fields.map((field) => (
                          <button
                            key={field.token}
                            type="button"
                            onClick={() => handleInsertPlaceholder(field.token)}
                            className="w-full text-left px-2 py-1 rounded-lg text-xs hover:bg-slate-100 flex items-center justify-between text-slate-800 group transition cursor-pointer"
                          >
                            <span className="font-semibold">{field.label}</span>
                            <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1 rounded group-hover:bg-emerald-100">
                              {field.token}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Toolbar: Zoom & Reset */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= 50}
              className="h-7 w-7 flex items-center justify-center rounded-md bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 transition cursor-pointer shadow-2xs"
              title="Zoom Out (-)"
            >
              <ZoomOut size={13} />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setZoomMenuOpen(!zoomMenuOpen);
                  setLogoMenuOpen(false);
                  setFieldMenuOpen(false);
                }}
                className="h-7 px-2 flex items-center gap-1 rounded-md text-xs font-bold text-slate-800 hover:bg-white transition cursor-pointer"
                title="Select Zoom Level"
              >
                <span>{zoom}%</span>
                <ChevronDown size={11} className="text-slate-500" />
              </button>

              {zoomMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setZoomMenuOpen(false)} />
                  <div className="absolute right-0 top-8 z-50 w-28 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                    {[50, 65, 75, 85, 100, 115, 125, 150, 175, 200].map((z) => (
                      <button
                        key={z}
                        type="button"
                        onClick={() => {
                          setZoom(z);
                          setZoomMenuOpen(false);
                        }}
                        className={`w-full text-left px-2 py-1 rounded text-xs font-semibold flex items-center justify-between ${
                          zoom === z
                            ? "bg-emerald-50 text-emerald-800 font-bold"
                            : "hover:bg-slate-100 text-slate-700"
                        }`}
                      >
                        <span>{z}%</span>
                        {z === 100 && <span className="text-[10px] text-slate-400">100%</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= 200}
              className="h-7 w-7 flex items-center justify-center rounded-md bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 transition cursor-pointer shadow-2xs"
              title="Zoom In (+)"
            >
              <ZoomIn size={13} />
            </button>

            <button
              type="button"
              onClick={handleZoomFit}
              className="h-7 px-2 flex items-center gap-1 rounded-md bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold transition cursor-pointer shadow-2xs"
              title="Fit to Window"
            >
              <Maximize2 size={11} />
              <span>Fit</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="h-8 px-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer shadow-2xs flex items-center gap-1"
            title="Reset Template to Official Legal Format"
          >
            <RotateCcw size={12} />
            <span className="hidden sm:inline">Reset Format</span>
          </button>
        </div>
      </div>

      {/* ── 3. PAPER CANVAS (AUTHENTIC BARANGAY LETTERHEAD + EDITABLE FLOW) ── */}
      <main
        className="flex-1 min-h-0 overflow-auto bg-[#cbd5e1] p-6 flex flex-col items-center custom-scrollbar"
        onClick={() => setSelectedCanvasObject(null)}
      >
        <div
          className="w-full flex justify-center items-start"
          style={{ minHeight: "100%" }}
        >
          <div
            className="real-doc-shell origin-top transition-transform duration-100 ease-out"
            data-editable="true"
            style={{
              transform: `scale(${zoom / 100})`,
              width: "8.5in",
              minHeight: "11in",
              marginBottom: zoom > 100 ? `${(zoom - 100) * 11}px` : "32px",
            }}
          >
            <article
              className={`real-doc-page real-doc-${docKey} bg-white shadow-2xl relative select-text`}
              style={{
                fontFamily: fontMap[fontFamily] || undefined,
                "--doc-body-font-size": fontSize ? `${fontSize}pt` : undefined,
                "--doc-line-height": lineHeight || undefined,
                WebkitFontSmoothing: "antialiased",
                MozOsxFontSmoothing: "grayscale",
                textRendering: "optimizeLegibility",
              }}
            >
              {/* ── REAL BARANGAY LETTERHEAD WITH INTEGRATED SEALS & CRISP BOTTOM BORDER ── */}
              <div
                className="real-doc-header relative"
                style={{
                  paddingTop: logoConfig.alignment === "center" ? "4px" : undefined,
                }}
              >
                {/* Primary Seal (Positioned inside the letterhead) */}
                {logoConfig.visible && (
                  <div
                    contentEditable={false}
                    className="select-none pointer-events-auto"
                    style={{
                      position: logoConfig.alignment === "center" ? "relative" : "absolute",
                      left:
                        logoConfig.alignment === "left" || logoConfig.alignment === "dual"
                          ? `calc(0.1in + ${logoConfig.offsetX}px)`
                          : undefined,
                      right:
                        logoConfig.alignment === "right"
                          ? `calc(0.1in + ${logoConfig.offsetX}px)`
                          : undefined,
                      top:
                        logoConfig.alignment === "center"
                          ? `${logoConfig.offsetY}px`
                          : `calc(-0.05in + ${logoConfig.offsetY}px)`,
                      display: logoConfig.alignment === "center" ? "flex" : undefined,
                      justifyContent: logoConfig.alignment === "center" ? "center" : undefined,
                      marginBottom: logoConfig.alignment === "center" ? "8px" : undefined,
                      zIndex: 25,
                    }}
                  >
                    <div className="relative group/seal inline-block">
                      <img
                        draggable={false}
                        src={logoConfig.url}
                        alt="Barangay Seal"
                        style={{
                          width: `${logoConfig.size}px`,
                          height: `${logoConfig.size}px`,
                          aspectRatio: "1 / 1",
                        }}
                        className={`rounded-full object-contain cursor-pointer transition select-none ${
                          selectedCanvasObject === "logo"
                            ? "ring-4 ring-emerald-600 ring-offset-2 shadow-2xl scale-102 border-2 border-dashed border-emerald-400"
                            : "hover:ring-2 hover:ring-emerald-400"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCanvasObject(selectedCanvasObject === "logo" ? null : "logo");
                        }}
                        onDragStart={(e) => e.preventDefault()}
                        title="Click to select Seal (Resize, Move, Cut, Upload, Paste)"
                      />

                      {/* Word-Style Floating Quick Action Pill */}
                      {selectedCanvasObject === "logo" && (
                        <div
                          contentEditable={false}
                          className="absolute -top-11 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-2xl flex items-center gap-2 whitespace-nowrap animate-fadeIn border border-slate-700"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                            <ImageIcon size={11} />
                            Seal ({logoConfig.size}px)
                          </span>
                          <div className="h-3 w-px bg-slate-700" />
                          <button
                            type="button"
                            onClick={() => setLogoConfig((prev) => ({ ...prev, size: Math.max(prev.size - 5, 40) }))}
                            className="p-1 rounded hover:bg-white/20 cursor-pointer"
                            title="Decrease size"
                          >
                            <Minus size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setLogoConfig((prev) => ({ ...prev, size: Math.min(prev.size + 5, 180) }))}
                            className="p-1 rounded hover:bg-white/20 cursor-pointer"
                            title="Increase size"
                          >
                            <Plus size={11} />
                          </button>
                          <div className="h-3 w-px bg-slate-700" />
                          <button
                            type="button"
                            onClick={() => logoFileInputRef.current?.click()}
                            className="text-emerald-300 hover:text-emerald-200 underline cursor-pointer"
                          >
                            Upload
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePasteLogoFromClipboard(false)}
                            className="text-sky-300 hover:text-sky-200 underline cursor-pointer"
                          >
                            Paste
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCutLogo(false)}
                            className="text-red-400 hover:text-red-300 flex items-center gap-0.5 cursor-pointer ml-1"
                          >
                            <Scissors size={10} />
                            <span>Cut</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedCanvasObject(null)}
                            className="ml-1 text-slate-400 hover:text-white"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Secondary Seal (Aleosan Municipal Seal for Dual Mode) */}
                {logoConfig.alignment === "dual" && logoConfig.secondaryVisible !== false && (
                  <div
                    contentEditable={false}
                    className="select-none pointer-events-auto"
                    style={{
                      position: "absolute",
                      right: `calc(0.1in + ${logoConfig.secondaryOffsetX}px)`,
                      top: `calc(-0.05in + ${logoConfig.secondaryOffsetY}px)`,
                      zIndex: 25,
                    }}
                  >
                    <div className="relative group/seal inline-block">
                      <img
                        draggable={false}
                        src={logoConfig.secondaryUrl || "/aleosan.logo.png"}
                        alt="Municipal Seal"
                        style={{
                          width: `${logoConfig.secondarySize}px`,
                          height: `${logoConfig.secondarySize}px`,
                          aspectRatio: "1 / 1",
                        }}
                        className={`rounded-full object-contain cursor-pointer transition select-none ${
                          selectedCanvasObject === "secondaryLogo"
                            ? "ring-4 ring-sky-500 ring-offset-2 shadow-2xl scale-102 border-2 border-dashed border-sky-400"
                            : "hover:ring-2 hover:ring-sky-400"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCanvasObject(selectedCanvasObject === "secondaryLogo" ? null : "secondaryLogo");
                        }}
                        onDragStart={(e) => e.preventDefault()}
                        title="Click to select Municipal Seal"
                      />

                      {/* Floating pill for secondary seal */}
                      {selectedCanvasObject === "secondaryLogo" && (
                        <div
                          contentEditable={false}
                          className="absolute -top-11 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-2xl flex items-center gap-2 whitespace-nowrap animate-fadeIn border border-slate-700"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-sky-400 font-extrabold flex items-center gap-1">
                            <ImageIcon size={11} />
                            Municipal ({logoConfig.secondarySize}px)
                          </span>
                          <div className="h-3 w-px bg-slate-700" />
                          <button
                            type="button"
                            onClick={() => setLogoConfig((prev) => ({ ...prev, secondarySize: Math.max(prev.secondarySize - 5, 40) }))}
                            className="p-1 rounded hover:bg-white/20 cursor-pointer"
                          >
                            <Minus size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setLogoConfig((prev) => ({ ...prev, secondarySize: Math.min(prev.secondarySize + 5, 180) }))}
                            className="p-1 rounded hover:bg-white/20 cursor-pointer"
                          >
                            <Plus size={11} />
                          </button>
                          <div className="h-3 w-px bg-slate-700" />
                          <button
                            type="button"
                            onClick={() => secondaryLogoFileInputRef.current?.click()}
                            className="text-sky-300 hover:text-sky-200 underline cursor-pointer"
                          >
                            Upload
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePasteLogoFromClipboard(true)}
                            className="text-emerald-300 hover:text-emerald-200 underline cursor-pointer"
                          >
                            Paste
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCutLogo(true)}
                            className="text-red-400 hover:text-red-300 flex items-center gap-0.5 cursor-pointer ml-1"
                          >
                            <Scissors size={10} />
                            <span>Cut</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedCanvasObject(null)}
                            className="ml-1 text-slate-400 hover:text-white"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Editable Header Text (Centered) */}
                <div
                  ref={headerEditorRef}
                  className="real-doc-header-text"
                >
                  <div
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                    onBlur={(e) => setHeaderConfig((prev) => ({ ...prev, country: e.target.innerText.trim() }))}
                  >
                    {headerConfig.country}
                  </div>
                  <div
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                    onBlur={(e) => setHeaderConfig((prev) => ({ ...prev, province: e.target.innerText.trim() }))}
                  >
                    {headerConfig.province}
                  </div>
                  <div
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                    onBlur={(e) => setHeaderConfig((prev) => ({ ...prev, municipality: e.target.innerText.trim() }))}
                  >
                    {headerConfig.municipality}
                  </div>
                  <div
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                    onBlur={(e) => setHeaderConfig((prev) => ({ ...prev, barangay: e.target.innerText.trim() }))}
                  >
                    {headerConfig.barangay}
                  </div>
                  <div
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                    className="real-doc-office"
                    onBlur={(e) => setHeaderConfig((prev) => ({ ...prev, office: e.target.innerText.trim() }))}
                  >
                    {headerConfig.office}
                  </div>
                </div>
              </div>

              {/* ── DOCUMENT TITLE ── */}
              <h1
                contentEditable={true}
                suppressContentEditableWarning={true}
                className="real-doc-title outline-none"
                onBlur={(e) => setHeaderConfig((prev) => ({ ...prev, title: e.target.innerText.trim() }))}
              >
                {headerConfig.title}
              </h1>

              {/* ── SALUTATION ── */}
              <p
                contentEditable={true}
                suppressContentEditableWarning={true}
                className="real-doc-to outline-none"
                onBlur={(e) => setHeaderConfig((prev) => ({ ...prev, salutation: e.target.innerText.trim() }))}
              >
                {headerConfig.salutation}
              </p>

              {/* ── EDITABLE BODY PARAGRAPHS ── */}
              <section
                ref={bodyEditorRef}
                contentEditable={true}
                suppressContentEditableWarning={true}
                onInput={handleEditorInput}
                onBlur={handleEditorInput}
                className="real-doc-body outline-none"
                style={{
                  minHeight: "3.5in",
                }}
              />

              {/* ── OFFICIAL SIGNATURE SECTION ── */}
              <section className={`real-doc-signature ${isClearance ? "real-doc-clearance-signature" : ""}`}>
                <p className="real-doc-captain-name">
                  {isClearance || isIndigency ? (
                    <u>
                      <strong
                        contentEditable={true}
                        suppressContentEditableWarning={true}
                        onBlur={(e) => setHeaderConfig((prev) => ({ ...prev, captainName: e.target.innerText.trim() }))}
                      >
                        {headerConfig.captainName}
                      </strong>
                    </u>
                  ) : (
                    <strong
                      contentEditable={true}
                      suppressContentEditableWarning={true}
                      onBlur={(e) => setHeaderConfig((prev) => ({ ...prev, captainName: e.target.innerText.trim() }))}
                    >
                      {headerConfig.captainName}
                    </strong>
                  )}
                </p>
                <p
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  className="real-doc-subtext"
                  onBlur={(e) => setHeaderConfig((prev) => ({ ...prev, captainTitle: e.target.innerText.trim() }))}
                >
                  {headerConfig.captainTitle}
                </p>
              </section>

              {/* ── OFFICIAL EXTRAS (THUMBMARK, O.R., CTC BOX) ── */}
              {isClearance && (
                <section className="real-doc-thumbmark" aria-hidden="true">
                  <span></span>
                </section>
              )}

              {!isSolo && headerConfig.showOrSection && (
                <section className={`real-doc-or real-doc-${docKey}-or`}>
                  {(isResidency || isIndigency) && (
                    <p style={{ marginBottom: "2px" }}>
                      <span
                        contentEditable={true}
                        suppressContentEditableWarning={true}
                        onBlur={(e) => setHeaderConfig((prev) => ({ ...prev, sealNote: e.target.innerText.trim() }))}
                      >
                        {headerConfig.sealNote || "Brgy. Seal/25"}
                      </span>
                    </p>
                  )}
                  <div className="real-doc-or-table">
                    <div className="real-doc-or-row">
                      <span className="real-doc-or-label">O. R. No.</span>
                      <span className="real-doc-or-val"><u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u></span>
                    </div>
                    <div className="real-doc-or-row">
                      <span className="real-doc-or-label">Date Issued:</span>
                      <span className="real-doc-or-val"><u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u></span>
                    </div>
                    {(isClearance || isResidency || isIndigency) && (
                      <div className="real-doc-or-row">
                        <span className="real-doc-or-label">CTC No.</span>
                        <span className="real-doc-or-val"><u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u></span>
                      </div>
                    )}
                    {isClearance && (
                      <div className="real-doc-or-row">
                        <span className="real-doc-or-label">Date Issued:</span>
                        <span className="real-doc-or-val"><u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u></span>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </article>
          </div>
        </div>

        {/* ── FLOATING ZOOM WIDGET ON CANVAS (BOTTOM RIGHT) ── */}
        <div className="fixed bottom-16 right-8 z-30 flex items-center gap-1 bg-slate-900/95 backdrop-blur-md px-2.5 py-1.5 rounded-2xl border border-slate-700 shadow-2xl text-white">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoom <= 50}
            className="p-1 rounded-lg hover:bg-white/20 disabled:opacity-40 transition cursor-pointer text-white"
            title="Zoom Out"
          >
            <ZoomOut size={14} className="text-white" />
          </button>
          <button
            type="button"
            onClick={handleZoomReset}
            className="px-2 py-0.5 rounded-lg text-xs font-black hover:bg-white/20 transition cursor-pointer text-white"
            title="Reset Zoom to 100%"
          >
            {zoom}%
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoom >= 200}
            className="p-1 rounded-lg hover:bg-white/20 disabled:opacity-40 transition cursor-pointer text-white"
            title="Zoom In"
          >
            <ZoomIn size={14} className="text-white" />
          </button>
          <div className="h-3.5 w-px bg-white/30 mx-0.5" />
          <button
            type="button"
            onClick={handleZoomFit}
            className="px-1.5 py-0.5 rounded-lg text-[11px] font-bold text-emerald-400 hover:bg-white/20 transition cursor-pointer"
            title="Fit Full Page"
          >
            Fit
          </button>
        </div>
      </main>

      {/* ── 4. FOOTER STATUS & SAVE BAR ── */}
      <footer className="h-12 bg-white border-t border-slate-300 px-6 flex items-center justify-between text-xs text-slate-600 shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-700">Page 1 of 1</span>
          <span className="text-slate-300">•</span>
          <span className="font-bold text-slate-900">{formData.template_name}</span>
          <span className="text-slate-300">•</span>
          <span className="text-slate-500 font-medium">
            {docStats.words} words • {docStats.characters} characters
          </span>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <span className="text-emerald-700 font-medium hidden sm:inline">
            Zoom: {zoom}% • Authentic Legal Barangay Format
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm transition cursor-pointer disabled:opacity-50 active:scale-95"
          >
            <Save size={13} />
            <span>{saving ? "Saving Changes..." : "Save Template & Update System"}</span>
          </button>
        </div>
      </footer>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalMarkup, document.body)
    : modalMarkup;
}
