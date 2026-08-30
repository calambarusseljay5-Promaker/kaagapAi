import { useState, useEffect, useRef } from "react";
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
  const [fieldMenuOpen, setFieldMenuOpen] = useState(false);
  
  // Word Typography & Spacing Controls matching Document Studio
  const [fontFamily, setFontFamily] = useState("rockwell");
  const [fontSize, setFontSize] = useState("14");
  const [lineHeight, setLineHeight] = useState("1.25");

  const editableBodyRef = useRef(null);

  // Helper to load or reset template content
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

  useEffect(() => {
    if (!isOpen) return;

    const tplName = template?.template_name || template?.document_type || "Certificate of Indigency";
    const key = getRealDocumentTemplateKey(tplName);
    const isKnownCategory = TEMPLATE_CATEGORIES.includes(template?.category);

    if (key === "residency" || key === "indigency" || key === "business" || key === "rsbsa" || key === "4ps") {
      setFontFamily("rockwell");
      setFontSize("14");
    } else {
      setFontFamily("times");
      setFontSize("12");
    }

    const initialBody = template?.content || getDefaultContentForKey(key);

    setFormData({
      template_name: tplName,
      category: isKnownCategory ? template.category : "Certification",
      description: template?.description || "Official barangay document template.",
      status: template?.status || "Active",
      content: initialBody,
    });

    setTimeout(() => {
      if (editableBodyRef.current) {
        editableBodyRef.current.innerHTML = initialBody;
      }
    }, 50);
  }, [template, isOpen]);

  if (!isOpen) return null;

  const handleEditableInput = () => {
    if (editableBodyRef.current) {
      const html = editableBodyRef.current.innerHTML;
      setFormData((prev) => ({ ...prev, content: html }));
    }
  };

  const executeCommand = (command, value = null) => {
    if (editableBodyRef.current) {
      editableBodyRef.current.focus();
      document.execCommand(command, false, value);
      handleEditableInput();
    }
  };

  const handleSelectAll = () => {
    if (editableBodyRef.current) {
      editableBodyRef.current.focus();
      const range = document.createRange();
      range.selectNodeContents(editableBodyRef.current);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  };

  const handleReset = () => {
    const key = getRealDocumentTemplateKey(formData.template_name);
    const defaultText = getDefaultContentForKey(key);
    if (editableBodyRef.current) {
      editableBodyRef.current.innerHTML = defaultText;
      handleEditableInput();
    }
  };

  const handleInsertPlaceholder = (token) => {
    if (editableBodyRef.current) {
      editableBodyRef.current.focus();
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
      handleEditableInput();
    }
    setFieldMenuOpen(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.template_name.trim()) return;

    const finalContent = editableBodyRef.current ? editableBodyRef.current.innerHTML : formData.content;

    onSave({
      ...formData,
      content: finalContent,
    });
  };

  const docKey = getRealDocumentTemplateKey(formData.template_name);
  const isSolo = docKey === "solo";
  const isClearance = docKey === "clearance";
  const isResidency = docKey === "residency";
  const isIndigency = docKey === "indigency";
  const isRSBSA = docKey === "rsbsa";

  const fontMap = {
    rockwell: '"Rockwell Condensed", "Rockwell", "Tw Cen MT Condensed", "Arial Narrow", serif',
    times: '"Times New Roman", Times, "Liberation Serif", serif',
    felix: '"Felix Titling", "Felix-Titling", "Times New Roman", serif',
    cooper: '"Cooper Std Black", "Cooper Black", serif, sans-serif',
    arial: 'Arial, Helvetica, sans-serif',
    georgia: 'Georgia, serif',
  };

  // Official title matching realDocumentTemplates output:
  // All certificates are titled "CERTIFICATION" except Barangay Clearance
  const officialDocumentTitle = isClearance ? "BARANGAY CLEARANCE" : "CERTIFICATION";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-6xl h-[92vh] max-h-[960px] bg-[#f8fafc] rounded-2xl shadow-2xl border border-slate-700/50 flex flex-col overflow-hidden">
        {/* Inject exact CSS from realDocumentTemplates */}
        <style>{REAL_DOCUMENT_CSS}</style>

        {/* ── 1. TOP APP BAR (Green Header matching Document Studio) ── */}
        <header className="flex items-center justify-between gap-4 bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 px-5 py-3 text-white shrink-0 border-b border-emerald-700/50 shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 backdrop-blur-md border border-white/20 shadow-inner">
              <FileText size={18} className="text-emerald-300" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300/80">
                Official Document Issuance System
              </p>
              <h1 className="text-sm font-black text-white tracking-tight flex items-center gap-2">
                <span>Document Studio — {formData.template_name}</span>
                <span className="text-[10px] font-bold bg-emerald-700/60 px-2 py-0.5 rounded-full border border-emerald-500/40 text-emerald-100">
                  Live System Template
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-xs font-black shadow-md transition cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <Save size={14} />
              <span>{saving ? "Saving Changes..." : "Save Template Changes"}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* ── 2. WORD TOOLBAR (Identical to Document Studio in Image 3) ── */}
        <div className="flex flex-wrap items-center gap-1.5 bg-white border-b border-slate-200 px-4 py-2 shrink-0 shadow-xs">
          {/* Font Family */}
          <select
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            className="h-8 rounded-lg border border-slate-300 bg-slate-50 px-2.5 text-xs font-bold text-slate-800 outline-none hover:bg-white focus:border-emerald-500 cursor-pointer shadow-2xs"
            title="Font Family"
          >
            <option value="rockwell">Rockwell Condensed</option>
            <option value="times">Times New Roman</option>
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
            <option value="12">12</option>
            <option value="13">13</option>
            <option value="14">14</option>
            <option value="15">15</option>
            <option value="16">16</option>
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

          {/* Select All Button */}
          <button
            type="button"
            onClick={handleSelectAll}
            className="h-8 px-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer shadow-2xs flex items-center gap-1"
            title="Select All Body Text"
          >
            <span>T</span>
            <span>Select All</span>
          </button>

          {/* Text Styles */}
          <button
            type="button"
            onClick={() => executeCommand("bold")}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 font-black transition cursor-pointer active:scale-95 shadow-2xs"
            title="Bold"
          >
            <Bold size={13} className="stroke-[2.5]" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand("italic")}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 italic transition cursor-pointer active:scale-95 shadow-2xs"
            title="Italic"
          >
            <Italic size={13} className="stroke-[2.5]" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand("underline")}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 underline transition cursor-pointer active:scale-95 shadow-2xs"
            title="Underline"
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

          <button
            type="button"
            onClick={handleReset}
            className="h-8 px-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold transition cursor-pointer shadow-2xs flex items-center gap-1"
            title="Reset to Original Format"
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>

          {/* Dynamic Placeholders */}
          <div className="relative inline-block ml-auto">
            <button
              type="button"
              onClick={() => setFieldMenuOpen(!fieldMenuOpen)}
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

        {/* ── 3. PAPER CANVAS (Identical to Image 3 & getRealDocumentMarkup) ── */}
        <main className="flex-1 overflow-auto bg-[#e8ecf0] relative flex justify-center py-6 px-4">
          <div className="real-doc-shell" data-editable="true">
            <article
              className={`real-doc-page real-doc-${docKey} bg-white shadow-xl`}
              style={{
                borderRadius: 1,
                fontFamily: fontMap[fontFamily] || fontMap.rockwell,
                "--doc-body-font-size": `${fontSize}pt`,
                "--doc-line-height": lineHeight,
              }}
            >
              {/* Header */}
              <div className="real-doc-header">
                <img className="real-doc-seal" src={BARANGAY_SEAL_SRC} alt="Barangay Seal" />
                <div className="real-doc-header-text">
                  <div>Republic of the Philippines</div>
                  <div>Province of Cotabato</div>
                  <div>Municipality of Aleosan</div>
                  <div>Barangay of Upper Mingading</div>
                  <div className="real-doc-office">OFFICE OF THE PUNONG BARANGAY</div>
                </div>
              </div>

              {/* Title: CERTIFICATION (or BARANGAY CLEARANCE) */}
              <h1 className="real-doc-title">{officialDocumentTitle}</h1>

              {/* TO WHOM IT MAY CONCERN */}
              <p className="real-doc-to">TO WHOM IT MAY CONCERN:</p>

              {/* Body Paragraphs (Directly WYSIWYG contentEditable) */}
              <section
                ref={editableBodyRef}
                contentEditable={true}
                suppressContentEditableWarning={true}
                onInput={handleEditableInput}
                onBlur={handleEditableInput}
                className="real-doc-body outline-none cursor-text"
                style={{
                  fontSize: `${fontSize}pt`,
                  lineHeight: lineHeight,
                }}
              />

              {/* Punong Barangay Signature (Right below paragraphs with natural margin) */}
              <section className="real-doc-signature">
                <p className="real-doc-captain-name">
                  <strong>{PUNONG_BARANGAY}</strong>
                </p>
                <p className="real-doc-subtext">Punong Barangay</p>
              </section>

              {/* Extras (OR / CTC Details in Bottom Left) */}
              {!isSolo && (
                <section className={`real-doc-or real-doc-${docKey}-or`}>
                  {(isResidency || isIndigency) && <p style={{ marginBottom: "2px" }}>Brgy. Seal/25</p>}
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
        </main>

        {/* ── 4. FOOTER STATUS & SAVE BAR ── */}
        <footer className="flex items-center justify-between border-t border-slate-200 bg-white px-5 py-2.5 text-xs text-slate-600 shrink-0 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Page 1 of 1</span>
            <span className="text-slate-300">•</span>
            <span className="font-bold text-slate-900">{formData.template_name}</span>
            <span className="text-slate-300">•</span>
            <span className="text-emerald-700 font-medium">Ready for real-time document issuance</span>
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
              className="flex items-center gap-1.5 px-5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              <Save size={13} />
              <span>{saving ? "Saving Changes..." : "Save Template & Update System"}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
