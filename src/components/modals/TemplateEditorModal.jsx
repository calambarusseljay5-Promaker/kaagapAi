import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Save,
  Bold,
  Italic,
  Underline,
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
} from "lucide-react";
import {
  AVAILABLE_PLACEHOLDERS,
  TEMPLATE_CATEGORIES,
  TEMPLATE_STATUSES,
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

  // Logo Customization & Realignment State
  const [logoConfig, setLogoConfig] = useState({
    url: BARANGAY_SEAL_SRC,
    alignment: "left", // 'left' | 'center' | 'right' | 'dual'
    size: 85, // in pixels
    offsetX: 0, // in pixels
    offsetY: 0, // in pixels
    visible: true,
    secondaryUrl: "/aleosan.logo.png",
    secondarySize: 85,
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

  // Ref for the Master Unified Editable Canvas
  const unifiedEditorRef = useRef(null);
  const logoFileInputRef = useRef(null);
  const secondaryLogoFileInputRef = useRef(null);

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

  // Helper to compile the entire full document HTML (Header Text + Title + Salutation + Body + Signature + CTC)
  const buildFullDocumentHtml = ({ key, header, bodyText }) => {
    const isSolo = key === "solo";
    const isClearance = key === "clearance";
    const isResidency = key === "residency";
    const isIndigency = key === "indigency";

    let orSectionHtml = "";
    if (!isSolo) {
      let sealNoteHtml = (isResidency || isIndigency) ? `<p class="real-doc-seal-note">${header.sealNote || "Brgy. Seal/25"}</p>` : "";
      let ctcRowHtml = (isClearance || isResidency || isIndigency) ? `
        <div class="real-doc-or-row">
          <span class="real-doc-or-label">CTC No.</span>
          <span class="real-doc-or-val"><u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u></span>
        </div>` : "";
      let clearanceDateRow = isClearance ? `
        <div class="real-doc-or-row">
          <span class="real-doc-or-label">Date Issued:</span>
          <span class="real-doc-or-val"><u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u></span>
        </div>` : "";

      orSectionHtml = `
        <div class="real-doc-or real-doc-${key}-or">
          ${sealNoteHtml}
          <div class="real-doc-or-table">
            <div class="real-doc-or-row">
              <span class="real-doc-or-label">O. R. No.</span>
              <span class="real-doc-or-val"><u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u></span>
            </div>
            <div class="real-doc-or-row">
              <span class="real-doc-or-label">Date Issued:</span>
              <span class="real-doc-or-val"><u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u></span>
            </div>
            ${ctcRowHtml}
            ${clearanceDateRow}
          </div>
        </div>
      `;
    }

    return `
      <div class="real-doc-header-text">
        <p>${header.country || "Republic of the Philippines"}</p>
        <p>${header.province || "Province of Cotabato"}</p>
        <p>${header.municipality || "Municipality of Aleosan"}</p>
        <p>${header.barangay || "Barangay of Upper Mingading"}</p>
        <p class="real-doc-office"><strong>${header.office || "OFFICE OF THE PUNONG BARANGAY"}</strong></p>
      </div>
      <h1 class="real-doc-title">${header.title || "BARANGAY CLEARANCE"}</h1>
      <p class="real-doc-to">${header.salutation || "TO WHOM IT MAY CONCERN:"}</p>
      <div class="real-doc-body">
        ${bodyText}
      </div>
      <div class="real-doc-signature real-doc-${key}-signature">
        <p class="real-doc-captain-name"><strong>${header.captainName || PUNONG_BARANGAY}</strong></p>
        <p class="real-doc-subtext">${header.captainTitle || "Punong Barangay"}</p>
      </div>
      ${orSectionHtml}
    `.trim();
  };

  // Strip any accidental <img> tags from the text container to prevent duplication
  const sanitizeTextHtml = (html) => {
    if (!html) return "";
    return html.replace(/<img[^>]*>/gi, "");
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
      size: Number(savedConfig.logoSize) || 85,
      offsetX: Number(savedConfig.logoOffsetX) || 0,
      offsetY: Number(savedConfig.logoOffsetY) || 0,
      visible: savedConfig.showLogo !== false,
      secondaryUrl: savedConfig.secondaryUrl || "/aleosan.logo.png",
      secondarySize: Number(savedConfig.secondarySize) || 85,
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

    const fullHtml = buildFullDocumentHtml({
      key,
      header: loadedHeaderConfig,
      bodyText: initialBody,
    });

    setTimeout(() => {
      if (unifiedEditorRef.current) {
        unifiedEditorRef.current.innerHTML = fullHtml;
      }
    }, 50);
  }, [template, isOpen]);

  // Global Keyboard Shortcuts (Ctrl+A, Ctrl+B, Ctrl+I, Ctrl+U, Ctrl+S)
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        return;
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (isCtrlOrCmd && e.key.toLowerCase() === "a") {
        e.preventDefault();
        handleSelectAll();
      } else if (isCtrlOrCmd && e.key.toLowerCase() === "s") {
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
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isOpen, formData]);

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
      } else {
        setLogoConfig((prev) => ({
          ...prev,
          url: event.target.result,
          visible: true,
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleEditorInput = () => {
    if (unifiedEditorRef.current) {
      // Remove any stray <img> tags if dropped accidentally
      const imgs = unifiedEditorRef.current.querySelectorAll("img");
      if (imgs.length > 0) {
        imgs.forEach((img) => img.remove());
      }
    }
  };

  const executeCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    handleEditorInput();
  };

  // Master Select All: Highlights the entire document from Header to Footer seamlessly!
  const handleSelectAll = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const targetElement = unifiedEditorRef.current;
    if (!targetElement) return;

    try {
      targetElement.focus();
      const range = document.createRange();
      range.selectNodeContents(targetElement);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (err) {
      console.warn("Select all range error:", err);
      document.execCommand("selectAll", false, null);
    }
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
      size: 85,
      offsetX: 0,
      offsetY: 0,
      visible: true,
      secondaryUrl: "/aleosan.logo.png",
      secondarySize: 85,
      secondaryOffsetX: 0,
      secondaryOffsetY: 0,
      secondaryVisible: false,
    });

    setHeaderConfig(defaultHeader);
    setSelectedCanvasObject(null);

    const fullHtml = buildFullDocumentHtml({
      key,
      header: defaultHeader,
      bodyText: defaultText,
    });

    if (unifiedEditorRef.current) {
      unifiedEditorRef.current.innerHTML = fullHtml;
    }
  };

  const handleInsertPlaceholder = (token) => {
    if (unifiedEditorRef.current) {
      unifiedEditorRef.current.focus();
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

  const handleSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!formData.template_name.trim()) return;

    let bodyHtml = formData.content;
    let extractedCountry = headerConfig.country;
    let extractedProvince = headerConfig.province;
    let extractedMunicipality = headerConfig.municipality;
    let extractedBarangay = headerConfig.barangay;
    let extractedOffice = headerConfig.office;
    let extractedTitle = headerConfig.title;
    let extractedSalutation = headerConfig.salutation;
    let extractedCaptainName = headerConfig.captainName;
    let extractedCaptainTitle = headerConfig.captainTitle;

    if (unifiedEditorRef.current) {
      // Clean any accidental img tags
      const imgs = unifiedEditorRef.current.querySelectorAll("img");
      imgs.forEach((img) => img.remove());

      const bodyEl = unifiedEditorRef.current.querySelector(".real-doc-body");
      if (bodyEl) {
        bodyHtml = bodyEl.innerHTML;
      } else {
        bodyHtml = unifiedEditorRef.current.innerHTML;
      }

      const headerTextEl = unifiedEditorRef.current.querySelector(".real-doc-header-text");
      if (headerTextEl) {
        const ps = headerTextEl.querySelectorAll("p, div");
        if (ps.length >= 1) extractedCountry = ps[0]?.innerText?.trim() || extractedCountry;
        if (ps.length >= 2) extractedProvince = ps[1]?.innerText?.trim() || extractedProvince;
        if (ps.length >= 3) extractedMunicipality = ps[2]?.innerText?.trim() || extractedMunicipality;
        if (ps.length >= 4) extractedBarangay = ps[3]?.innerText?.trim() || extractedBarangay;
        if (ps.length >= 5) extractedOffice = ps[4]?.innerText?.trim() || extractedOffice;
      }

      const titleEl = unifiedEditorRef.current.querySelector(".real-doc-title");
      if (titleEl) extractedTitle = titleEl.innerText?.trim() || extractedTitle;

      const salutationEl = unifiedEditorRef.current.querySelector(".real-doc-to");
      if (salutationEl) extractedSalutation = salutationEl.innerText?.trim() || extractedSalutation;

      const captainEl = unifiedEditorRef.current.querySelector(".real-doc-captain-name");
      if (captainEl) extractedCaptainName = captainEl.innerText?.trim() || extractedCaptainName;

      const captainTitleEl = unifiedEditorRef.current.querySelector(".real-doc-subtext");
      if (captainTitleEl) extractedCaptainTitle = captainTitleEl.innerText?.trim() || extractedCaptainTitle;
    }

    const compiledHeaderConfig = {
      country: extractedCountry,
      province: extractedProvince,
      municipality: extractedMunicipality,
      barangay: extractedBarangay,
      office: extractedOffice,
      title: extractedTitle,
      salutation: extractedSalutation,
      captainName: extractedCaptainName,
      captainTitle: extractedCaptainTitle,
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
    felix: '"Felix Titling", "Felix-Titling", "Times New Roman", serif',
    cooper: '"Cooper Std Black", "Cooper Black", serif, sans-serif',
    arial: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
    georgia: 'Georgia, "Times New Roman", serif',
  };

  const modalMarkup = (
    <div className="fixed inset-0 z-[99999] w-screen h-screen bg-[#cbd5e1] flex flex-col overflow-hidden select-none animate-fadeIn">
      {/* Inject exact CSS from realDocumentTemplates */}
      <style>{REAL_DOCUMENT_CSS}</style>

      {/* ── 1. TOP APP BAR (Steady Fullscreen Header) ── */}
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
                  Document Studio
                </span>
              </div>
              <p className="text-[10px] font-medium text-emerald-300/80 truncate">
                Full-page continuous highlight • Select All (Ctrl+A) • Clean Logo Positioning
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md transition cursor-pointer active:scale-95 shrink-0"
            title="Exit Studio"
          >
            <X size={15} />
            <span>Exit</span>
          </button>
        </div>
      </header>

      {/* ── 2. WORD TOOLBAR WITH LOGO CONTROLS & ZOOM CONTROLS ── */}
      <div className="h-12 bg-white border-b border-slate-300 px-4 flex items-center justify-between gap-2 shrink-0 shadow-xs z-20 overflow-x-auto">
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Font Family */}
          <select
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            className="h-8 rounded-lg border border-slate-300 bg-slate-50 px-2.5 text-xs font-bold text-slate-800 outline-none hover:bg-white focus:border-emerald-500 cursor-pointer shadow-2xs"
            title="Font Family"
          >
            <option value="times">Times New Roman</option>
            <option value="rockwell">Rockwell Condensed</option>
            <option value="felix">Felix Titling</option>
            <option value="cooper">Cooper Std Black</option>
            <option value="arial">Arial</option>
            <option value="georgia">Georgia</option>
          </select>

          {/* Font Size */}
          <select
            value={fontSize}
            onChange={(e) => setFontSize(e.target.value)}
            className="h-8 rounded-lg border border-slate-300 bg-slate-50 px-2 text-xs font-bold text-slate-800 outline-none hover:bg-white focus:border-emerald-500 cursor-pointer shadow-2xs"
            title="Font Size"
          >
            <option value="10">10 pt</option>
            <option value="11">11 pt</option>
            <option value="12">12 pt</option>
            <option value="13">13 pt</option>
            <option value="14">14 pt</option>
            <option value="15">15 pt</option>
            <option value="16">16 pt</option>
            <option value="18">18 pt</option>
          </select>

          {/* Line Spacing */}
          <select
            value={lineHeight}
            onChange={(e) => setLineHeight(e.target.value)}
            className="h-8 rounded-lg border border-slate-300 bg-slate-50 px-2 text-xs font-bold text-slate-800 outline-none hover:bg-white focus:border-emerald-500 cursor-pointer shadow-2xs"
            title="Line Spacing"
          >
            <option value="1.15">1.15x</option>
            <option value="1.25">1.25x Normal</option>
            <option value="1.35">1.35x</option>
            <option value="1.5">1.50x</option>
            <option value="2.0">2.00x</option>
          </select>

          <div className="h-5 w-px bg-slate-200 mx-1" />

          {/* Master Select All Button (Ctrl+A) */}
          <button
            type="button"
            onClick={handleSelectAll}
            className="h-8 px-3 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-black transition cursor-pointer shadow-2xs flex items-center gap-1.5 active:scale-95"
            title="Select Entire Document (Ctrl + A)"
          >
            <span className="font-mono text-emerald-700 bg-white/80 px-1 py-0.2 rounded text-[10px] border border-emerald-200">Ctrl+A</span>
            <span>Select All</span>
          </button>

          <div className="h-5 w-px bg-slate-200 mx-1" />

          {/* Text Styles */}
          <button
            type="button"
            onClick={() => executeCommand("bold")}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 font-black transition cursor-pointer active:scale-95 shadow-2xs"
            title="Bold (Ctrl+B)"
          >
            <Bold size={13} className="stroke-[2.5]" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand("italic")}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 italic transition cursor-pointer active:scale-95 shadow-2xs"
            title="Italic (Ctrl+I)"
          >
            <Italic size={13} className="stroke-[2.5]" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand("underline")}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 underline transition cursor-pointer active:scale-95 shadow-2xs"
            title="Underline (Ctrl+U)"
          >
            <Underline size={13} className="stroke-[2.5]" />
          </button>

          {/* Alignments */}
          <button
            type="button"
            onClick={() => executeCommand("justifyLeft")}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 transition cursor-pointer active:scale-95 shadow-2xs"
            title="Align Left"
          >
            <AlignLeft size={13} />
          </button>
          <button
            type="button"
            onClick={() => executeCommand("justifyCenter")}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 transition cursor-pointer active:scale-95 shadow-2xs"
            title="Align Center"
          >
            <AlignCenter size={13} />
          </button>
          <button
            type="button"
            onClick={() => executeCommand("justifyRight")}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 transition cursor-pointer active:scale-95 shadow-2xs"
            title="Align Right"
          >
            <AlignRight size={13} />
          </button>
          <button
            type="button"
            onClick={() => executeCommand("justifyFull")}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 transition cursor-pointer active:scale-95 shadow-2xs"
            title="Justify"
          >
            <AlignJustify size={13} />
          </button>

          <div className="h-5 w-px bg-slate-200 mx-1" />

          {/* ── LOGO CONTROLS MENU POPOVER ── */}
          <div className="relative inline-block">
            <button
              type="button"
              onClick={() => {
                setLogoMenuOpen(!logoMenuOpen);
                setZoomMenuOpen(false);
                setFieldMenuOpen(false);
              }}
              className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold transition cursor-pointer shadow-2xs"
              title="Logo Customization, Alignment & Sizing"
            >
              <ImageIcon size={13} className="text-emerald-700" />
              <span>Logo: {logoConfig.alignment.toUpperCase()} ({logoConfig.size}px)</span>
              <ChevronDown size={12} />
            </button>

            {logoMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setLogoMenuOpen(false)} />
                <div className="absolute left-0 top-9 z-50 w-88 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <ImageIcon size={14} className="text-emerald-600" />
                      Logo & Seal Positioning & Sizing
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setLogoConfig((prev) => ({ ...prev, visible: !prev.visible }))
                      }
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 cursor-pointer ${
                        logoConfig.visible
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {logoConfig.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                      {logoConfig.visible ? "Visible" : "Hidden"}
                    </button>
                  </div>

                  {/* Alignment Options */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      Logo Alignment / Position:
                    </label>
                    <div className="grid grid-cols-4 gap-1">
                      {[
                        { id: "left", label: "Left" },
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
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold transition text-center cursor-pointer ${
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

                  {/* Size Slider & Presets */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
                      <span>Primary Seal Size:</span>
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
                        min="40"
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
                    <div className="flex justify-between gap-1 mt-1.5">
                      {[
                        { label: "S (60px)", val: 60 },
                        { label: "M (85px)", val: 85 },
                        { label: "L (110px)", val: 110 },
                        { label: "XL (135px)", val: 135 },
                      ].map((preset) => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => setLogoConfig((prev) => ({ ...prev, size: preset.val }))}
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border cursor-pointer ${
                            logoConfig.size === preset.val
                              ? "border-emerald-500 bg-emerald-50 text-emerald-800 font-bold"
                              : "border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Fine Position Offset Sliders (X and Y) */}
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

                  {/* Upload Custom Logo */}
                  <div className="pt-2 border-t border-slate-100">
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
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-emerald-400 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-900 text-xs font-bold transition cursor-pointer"
                    >
                      <Upload size={12} />
                      <span>Upload Custom Seal / Logo</span>
                    </button>
                  </div>

                  {/* Dual Mode Secondary Logo */}
                  {logoConfig.alignment === "dual" && (
                    <div className="pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
                        <span>Right Municipal Seal Size:</span>
                        <span className="text-emerald-700 font-black">{logoConfig.secondarySize} px</span>
                      </div>
                      <input
                        type="range"
                        min="40"
                        max="180"
                        step="5"
                        value={logoConfig.secondarySize}
                        onChange={(e) =>
                          setLogoConfig((prev) => ({
                            ...prev,
                            secondarySize: Number(e.target.value),
                          }))
                        }
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                      <input
                        ref={secondaryLogoFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleLogoUpload(e, true)}
                      />
                      <button
                        type="button"
                        onClick={() => secondaryLogoFileInputRef.current?.click()}
                        className="w-full mt-1.5 flex items-center justify-center gap-1.5 py-1 rounded-lg border border-dashed border-slate-300 hover:bg-slate-50 text-slate-700 text-[11px] font-bold transition cursor-pointer"
                      >
                        <Upload size={11} />
                        <span>Upload Right Municipal Seal</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="h-5 w-px bg-slate-200 mx-1" />

          {/* ── ZOOM CONTROLS ── */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
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
                  <div className="absolute left-0 top-8 z-50 w-28 rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
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

          {/* Reset button */}
          <button
            type="button"
            onClick={handleReset}
            className="h-8 px-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold transition cursor-pointer shadow-2xs flex items-center gap-1"
            title="Reset All Elements to Default"
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>
        </div>

        {/* Dynamic Placeholders */}
        <div className="relative inline-block ml-auto shrink-0">
          <button
            type="button"
            onClick={() => {
              setFieldMenuOpen(!fieldMenuOpen);
              setLogoMenuOpen(false);
              setZoomMenuOpen(false);
            }}
            className="h-8 px-3.5 flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm transition cursor-pointer active:scale-95"
          >
            <Sparkles size={13} />
            <span>+ Insert Field</span>
            <ChevronDown size={12} />
          </button>

          {fieldMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setFieldMenuOpen(false)} />
              <div className="absolute right-0 top-9 z-50 w-72 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-2xl">
                <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                  Insert Dynamic Field Placeholder
                </div>
                {AVAILABLE_PLACEHOLDERS.map((group) => (
                  <div key={group.category} className="mb-2">
                    <div className="px-2 py-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 rounded">
                      {group.category}
                    </div>
                    <div className="space-y-0.5 mt-1">
                      {group.fields.map((field) => (
                        <button
                          key={field.token}
                          type="button"
                          onClick={() => handleInsertPlaceholder(field.token)}
                          className="w-full text-left px-2 py-1 rounded text-xs hover:bg-slate-100 flex items-center justify-between text-slate-800 group transition cursor-pointer"
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

      {/* ── 3. PAPER CANVAS (UNIFIED SEAMLESS EDITABLE FLOW) ── */}
      <main className="flex-1 min-h-0 overflow-auto bg-[#cbd5e1] p-6 flex flex-col items-center custom-scrollbar">
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
              {/* ── LOGO LAYER (UN-EDITABLE, NON-DUPLICATING OVERLAY) ── */}
              {logoConfig.visible && (
                <div
                  contentEditable={false}
                  className="select-none pointer-events-auto"
                  style={{
                    position: logoConfig.alignment === "center" ? "relative" : "absolute",
                    left:
                      logoConfig.alignment === "left" || logoConfig.alignment === "dual"
                        ? `${10 + logoConfig.offsetX}px`
                        : undefined,
                    right:
                      logoConfig.alignment === "right"
                        ? `${10 + logoConfig.offsetX}px`
                        : undefined,
                    top:
                      logoConfig.alignment === "center"
                        ? `${logoConfig.offsetY}px`
                        : `${-5 + logoConfig.offsetY}px`,
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
                          ? "ring-3 ring-emerald-500 ring-offset-2 shadow-xl scale-105"
                          : "hover:ring-2 hover:ring-emerald-400"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCanvasObject(selectedCanvasObject === "logo" ? null : "logo");
                      }}
                      onDragStart={(e) => e.preventDefault()}
                      title="Click to adjust Barangay Seal"
                    />

                    {/* On-Canvas Floating Quick Action Pill */}
                    {selectedCanvasObject === "logo" && (
                      <div
                        contentEditable={false}
                        className="absolute -top-10 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-2xl flex items-center gap-1.5 whitespace-nowrap animate-fadeIn border border-slate-700"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setLogoConfig((prev) => ({ ...prev, size: Math.max(prev.size - 5, 40) }))}
                          className="p-0.5 rounded hover:bg-white/20 cursor-pointer"
                          title="Decrease size"
                        >
                          <Minus size={11} />
                        </button>
                        <span>{logoConfig.size}px</span>
                        <button
                          type="button"
                          onClick={() => setLogoConfig((prev) => ({ ...prev, size: Math.min(prev.size + 5, 180) }))}
                          className="p-0.5 rounded hover:bg-white/20 cursor-pointer"
                          title="Increase size"
                        >
                          <Plus size={11} />
                        </button>
                        <span className="text-slate-500">|</span>
                        <button
                          type="button"
                          onClick={() => logoFileInputRef.current?.click()}
                          className="text-emerald-300 hover:text-emerald-200 underline cursor-pointer"
                        >
                          Upload
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedCanvasObject(null)}
                          className="ml-1 text-slate-400 hover:text-white"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Secondary Seal for Dual Mode (Aleosan Municipal Seal) */}
              {logoConfig.alignment === "dual" && (
                <div
                  contentEditable={false}
                  className="select-none pointer-events-auto"
                  style={{
                    position: "absolute",
                    right: `${10 + logoConfig.secondaryOffsetX}px`,
                    top: `${-5 + logoConfig.secondaryOffsetY}px`,
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
                          ? "ring-3 ring-sky-500 ring-offset-2 shadow-xl scale-105"
                          : "hover:ring-2 hover:ring-sky-400"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCanvasObject(selectedCanvasObject === "secondaryLogo" ? null : "secondaryLogo");
                      }}
                      onDragStart={(e) => e.preventDefault()}
                      title="Click to adjust Municipal Seal"
                    />

                    {/* On-Canvas Floating Quick Action Pill for Secondary Logo */}
                    {selectedCanvasObject === "secondaryLogo" && (
                      <div
                        contentEditable={false}
                        className="absolute -top-10 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-2xl flex items-center gap-1.5 whitespace-nowrap animate-fadeIn border border-slate-700"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setLogoConfig((prev) => ({ ...prev, secondarySize: Math.max(prev.secondarySize - 5, 40) }))}
                          className="p-0.5 rounded hover:bg-white/20 cursor-pointer"
                          title="Decrease size"
                        >
                          <Minus size={11} />
                        </button>
                        <span>{logoConfig.secondarySize}px</span>
                        <button
                          type="button"
                          onClick={() => setLogoConfig((prev) => ({ ...prev, secondarySize: Math.min(prev.secondarySize + 5, 180) }))}
                          className="p-0.5 rounded hover:bg-white/20 cursor-pointer"
                          title="Increase size"
                        >
                          <Plus size={11} />
                        </button>
                        <span className="text-slate-500">|</span>
                        <button
                          type="button"
                          onClick={() => secondaryLogoFileInputRef.current?.click()}
                          className="text-sky-300 hover:text-sky-200 underline cursor-pointer"
                        >
                          Upload
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedCanvasObject(null)}
                          className="ml-1 text-slate-400 hover:text-white"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── 4. UNIFIED CONTINUOUS EDITABLE TEXT FLOW (HEADER TO FOOTER) ── */}
              <div
                ref={unifiedEditorRef}
                contentEditable={true}
                suppressContentEditableWarning={true}
                onInput={handleEditorInput}
                onBlur={handleEditorInput}
                onDrop={(e) => e.preventDefault()}
                className="outline-none cursor-text w-full min-h-[9in]"
                style={{
                  outline: "none",
                  WebkitUserModify: "read-write",
                }}
              />
            </article>
          </div>
        </div>

        {/* ── FLOATING QUICK ZOOM WIDGET ON CANVAS (BOTTOM RIGHT - CRISP HIGH CONTRAST) ── */}
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

      {/* ── 5. FOOTER STATUS & SAVE BAR ── */}
      <footer className="h-12 bg-white border-t border-slate-300 px-6 flex items-center justify-between text-xs text-slate-600 shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">Page 1 of 1</span>
          <span className="text-slate-300">•</span>
          <span className="font-bold text-slate-900">{formData.template_name}</span>
          <span className="text-slate-300">•</span>
          <span className="text-emerald-700 font-medium">
            Zoom: {zoom}% • Select All (Ctrl+A) • Full Continuous Highlight
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
