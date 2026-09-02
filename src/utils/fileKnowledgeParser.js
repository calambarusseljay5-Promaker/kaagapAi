import mammoth from "mammoth";
import { generateText } from "../services/geminiService";

/**
 * Extracts plain text or base64 from various file formats (.txt, .md, .json, .csv, .docx, .pdf, images)
 * @param {File} file
 * @returns {Promise<{ text: string, title: string, isImage?: boolean, base64?: string, mimeType?: string, fileName: string, sizeKb: number }>}
 */
export async function parseFileToKnowledgeText(file) {
  if (!file) throw new Error("No file selected.");

  const name = file.name || "Imported Document";
  const sizeKb = Math.round(file.size / 1024);
  const lastDotIndex = name.lastIndexOf(".");
  const extension = lastDotIndex !== -1 ? name.slice(lastDotIndex).toLowerCase() : "";
  const rawTitle = lastDotIndex !== -1 ? name.substring(0, lastDotIndex) : name;
  const title = rawTitle.replace(/[-_]/g, " ").trim();

  // 1. Image Files (OCR via Gemini)
  if (
    [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"].includes(extension) ||
    file.type.startsWith("image/")
  ) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = String(reader.result || "");
        resolve({
          text: "",
          title,
          isImage: true,
          base64,
          mimeType: file.type || "image/jpeg",
          fileName: name,
          sizeKb,
        });
      };
      reader.onerror = () => reject(new Error("Failed to read image file."));
      reader.readAsDataURL(file);
    });
  }

  // 2. Text-based files (.txt, .md, .json, .csv, .log, .html)
  if (
    [".txt", ".md", ".json", ".csv", ".log", ".html", ".htm"].includes(extension) ||
    file.type.startsWith("text/")
  ) {
    const text = await file.text();
    if (!text.trim()) throw new Error("The selected text file is empty.");
    return { text: text.trim(), title, fileName: name, sizeKb };
  }

  // 3. Word (.docx) files
  if (extension === ".docx") {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const extractedText = result.value ? result.value.trim() : "";
      if (!extractedText) {
        throw new Error("No readable text found in this Word document.");
      }
      return { text: extractedText, title, fileName: name, sizeKb };
    } catch (err) {
      throw new Error(`Failed to read Word document (.docx): ${err.message}`);
    }
  }

  // 4. PDF (.pdf) files
  if (extension === ".pdf") {
    try {
      const arrayBuffer = await file.arrayBuffer();
      let pdfjsLib = null;

      try {
        pdfjsLib = await import("pdfjs-dist");
        if (pdfjsLib?.GlobalWorkerOptions) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || "3.11.174"}/pdf.worker.min.mjs`;
        }
      } catch (importErr) {
        pdfjsLib = window.pdfjsLib || null;
      }

      if (pdfjsLib && pdfjsLib.getDocument) {
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdfDoc = await loadingTask.promise;
        let fullText = "";

        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
          const page = await pdfDoc.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item) => item.str)
            .join(" ")
            .replace(/\s+/g, " ");
          if (pageText.trim()) {
            fullText += (fullText ? "\n\n" : "") + pageText.trim();
          }
        }

        const trimmedText = fullText.trim();
        if (trimmedText) {
          return { text: trimmedText, title, fileName: name, sizeKb };
        }
      }
    } catch (err) {
      // PDF text extraction fallback
    }

    // PDF text stream regex fallback
    try {
      const arrayBuffer = await file.arrayBuffer();
      const textDecoder = new TextDecoder("latin1");
      const rawString = textDecoder.decode(arrayBuffer);
      const matches = rawString.match(/\(([^\(\)\\]|\\[\s\S])*\)\s*(?:Tj|TJ)/g);
      if (matches && matches.length > 0) {
        const extracted = matches
          .map((m) => m.replace(/[\(\)]/g, "").replace(/\s*(Tj|TJ)$/, ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        if (extracted.length > 20) {
          return { text: extracted, title, fileName: name, sizeKb };
        }
      }
    } catch (fallbackErr) {
      // ignore
    }

    // Fallback: If PDF couldn't be parsed directly, convert to base64 so Gemini can process it
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          text: "",
          title,
          isImage: true,
          base64: String(reader.result || ""),
          mimeType: "application/pdf",
          fileName: name,
          sizeKb,
        });
      };
      reader.onerror = () => reject(new Error("Could not process PDF."));
      reader.readAsDataURL(file);
    });
  }

  // 5. Plain text fallback
  try {
    const text = await file.text();
    const cleanText = text
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (cleanText.length > 30) {
      return { text: cleanText, title, fileName: name, sizeKb };
    }
  } catch (e) {
    // ignore
  }

  throw new Error(
    `Unsupported file format (${extension || "unknown"}). Please select a Word (.docx), PDF (.pdf), Text (.txt), Markdown (.md), or Image (.jpg/.png) file.`
  );
}

function detectCategoryFromText(text = "") {
  const lower = text.toLowerCase();
  if (lower.includes("curfew") || lower.includes("disaster") || lower.includes("safety") || lower.includes("tanod") || lower.includes("peace") || lower.includes("fire") || lower.includes("calamity")) return "Public Safety & Disaster";
  if (lower.includes("health") || lower.includes("medical") || lower.includes("vaccine") || lower.includes("sanitation") || lower.includes("gamot") || lower.includes("clinic") || lower.includes("dental") || lower.includes("checkup")) return "Health & Sanitation";
  if (lower.includes("ordinance") || lower.includes("ordinansa") || lower.includes("policy") || lower.includes("patakaran") || lower.includes("bawal") || lower.includes("multa") || lower.includes("penalty") || lower.includes("resolution")) return "Ordinances & Policies";
  if (lower.includes("livelihood") || lower.includes("job") || lower.includes("trabaho") || lower.includes("agri") || lower.includes("farmer") || lower.includes("crop") || lower.includes("tesda") || lower.includes("training")) return "Agriculture & Livelihood";
  if (lower.includes("clearance") || lower.includes("certificate") || lower.includes("residency") || lower.includes("indigency") || lower.includes("permit") || lower.includes("cedula") || lower.includes("valid id")) return "Document Processing";
  if (lower.includes("senior") || lower.includes("pwd") || lower.includes("solo parent") || lower.includes("ayuda") || lower.includes("welfare") || lower.includes("4ps") || lower.includes("financial")) return "Social Welfare";
  if (lower.includes("council") || lower.includes("official") || lower.includes("kapitan") || lower.includes("kagawad") || lower.includes("governance") || lower.includes("session")) return "Governance";
  return "General";
}

function generateFallbackQuestions(titleOrText = "") {
  const clean = titleOrText.slice(0, 45).replace(/[#*_\n\r]/g, "").trim();
  return [
    `Ano ang mga alituntunin at patakaran ukol sa ${clean}?`,
    `Paano ang proseso at ano ang mga requirements para sa ${clean}?`,
    `Sino ang target at saan ipinapatupad ang ${clean}?`
  ];
}

function generateSmartLocalKnowledgeStructure(fileResult) {
  const rawText = fileResult.text || fileResult.title || "Barangay Policy & Guidelines";
  const title = fileResult.title || "Barangay Official Knowledge Record";
  const category = detectCategoryFromText(rawText);
  const sampleQuestions = generateFallbackQuestions(title);

  let formattedContent = rawText;
  if (!rawText.includes("•") && !rawText.includes("1.")) {
    const lines = rawText.split(/[\n.]+/).map((l) => l.trim()).filter((l) => l.length > 5);
    if (lines.length > 1) {
      formattedContent = `📌 **Mga Alituntunin at Impormasyon ukol sa ${title}:**\n\n` + lines.map((l) => `• ${l}`).join("\n");
    }
  }

  return {
    title: title.length > 5 ? title : "Barangay Official Knowledge Record",
    category,
    audience: "All Residents",
    summary: `Opisyal na patakaran at alituntunin ukol sa ${title} para sa mga residente ng Barangay Upper Mingading.`,
    content: formattedContent,
    sampleQuestions,
  };
}

/**
 * Uses Gemini to automatically analyze, summarize, and structure raw text/document into high-quality Barangay AI Knowledge.
 * Falls back seamlessly to smart local extraction if AI service is offline or rate limited.
 * @param {{ text?: string, title?: string, isImage?: boolean, base64?: string, mimeType?: string, fileName?: string }} fileResult
 * @returns {Promise<{ title: string, category: string, audience: string, content: string, summary: string, sampleQuestions: string[] }>}
 */
export async function analyzeAndStructureKnowledgeWithAi(fileResult) {
  const rawText = fileResult.text || fileResult.title || "";

  try {
    const systemInstruction = `You are the Lead AI Knowledge Engineer for Barangay Upper Mingading, Aleosan, Cotabato.
Your job is to read documents (memos, resolutions, circulars, announcements, guidelines, forms, ordinances, or meeting minutes) and transform them into crystal-clear, structured knowledge that will be directly injected into the KaagapAI Resident Chatbot knowledge base.

OUTPUT FORMAT REQUIREMENTS:
You MUST respond with a valid JSON object ONLY (no markdown code fences, no extra commentary) with the following structure:
{
  "title": "Clear, formal, and descriptive title (e.g., Barangay Ordinance No. 2026-02: Waste Segregation Policy)",
  "category": "One of: General, Governance, Health & Sanitation, Public Safety & Disaster, Social Welfare, Ordinances & Policies, Agriculture & Livelihood, Document Processing",
  "audience": "One of: All Residents, Registered Residents, Senior Citizens, Youth, PWD/PWED Residents, Family Household Representatives, Admin Only",
  "summary": "1 to 2 sentence executive summary of the document",
  "content": "Comprehensive, structured knowledge text formatted with headers, bullet points, rules, requirements, fees (if any), step-by-step procedures, and key details that the resident chatbot will reference when answering inquiries.",
  "sampleQuestions": [
    "Sample question a resident might ask in Tagalog/English",
    "Another question residents might ask",
    "Third sample question"
  ]
}`;

    let prompt = "";
    let options = {
      systemInstruction,
      temperature: 0.2,
      maxOutputTokens: 2048,
    };

    if (fileResult.isImage && fileResult.base64) {
      prompt = `Analyze this uploaded document/memo image "${fileResult.fileName || fileResult.title}". Extract all text, policies, dates, requirements, and information. Then format it as JSON according to the instructions.`;
      options.fileData = {
        mimeType: fileResult.mimeType || "image/jpeg",
        data: fileResult.base64,
      };
    } else {
      prompt = `Analyze the following extracted document text from "${fileResult.fileName || fileResult.title}". Extract and organize all policies, guidelines, requirements, and barangay information into clean, high-precision knowledge for the resident chatbot.\n\nDOCUMENT CONTENT:\n${rawText.slice(0, 10000)}`;
    }

    const response = await generateText(prompt, options);
    const rawOutput =
      response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      response?.text ||
      "";

    // Clean JSON string
    const cleanJson = rawOutput
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleanJson);
    return {
      title: parsed.title || fileResult.title || "Barangay Knowledge Record",
      category: parsed.category || detectCategoryFromText(rawText),
      audience: parsed.audience || "All Residents",
      summary: parsed.summary || "",
      content: parsed.content || rawText,
      sampleQuestions: Array.isArray(parsed.sampleQuestions) && parsed.sampleQuestions.length > 0
        ? parsed.sampleQuestions
        : generateFallbackQuestions(fileResult.title || rawText),
    };
  } catch (err) {
    console.warn("AI Knowledge Structuring fallback activated:", err.message);
    return generateSmartLocalKnowledgeStructure(fileResult);
  }
}

