import mammoth from "mammoth";

/**
 * Extracts plain text from various file formats (.txt, .md, .json, .csv, .docx, .pdf)
 * @param {File} file
 * @returns {Promise<{ text: string, title: string }>}
 */
export async function parseFileToKnowledgeText(file) {
  if (!file) throw new Error("No file selected.");

  const name = file.name || "Imported Document";
  const lastDotIndex = name.lastIndexOf(".");
  const extension = lastDotIndex !== -1 ? name.slice(lastDotIndex).toLowerCase() : "";
  const rawTitle = lastDotIndex !== -1 ? name.substring(0, lastDotIndex) : name;
  const title = rawTitle.replace(/[-_]/g, " ").trim();

  // 1. Text-based files (.txt, .md, .json, .csv, .log, .html)
  if (
    [".txt", ".md", ".json", ".csv", ".log", ".html", ".htm"].includes(extension) ||
    file.type.startsWith("text/")
  ) {
    const text = await file.text();
    if (!text.trim()) throw new Error("The selected text file is empty.");
    return { text: text.trim(), title };
  }

  // 2. Word (.docx) files
  if (extension === ".docx") {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const extractedText = result.value ? result.value.trim() : "";
      if (!extractedText) {
        throw new Error("No readable text found in this Word document.");
      }
      return { text: extractedText, title };
    } catch (err) {
      throw new Error(`Failed to read Word document (.docx): ${err.message}`);
    }
  }

  // 3. PDF (.pdf) files
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
        if (!trimmedText) {
          throw new Error("PDF contains no selectable text (it may be a scanned image/photo PDF).");
        }
        return { text: trimmedText, title };
      }
    } catch (err) {
      // If PDF JS library fails, fallback to simple text parsing attempt
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
          return { text: extracted, title };
        }
      }
    } catch (fallbackErr) {
      // ignore fallback error
    }

    throw new Error("Could not extract text from this PDF file. Ensure it contains readable text.");
  }

  // 4. Legacy Word (.doc) or other files fallback
  try {
    const text = await file.text();
    const cleanText = text
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (cleanText.length > 30) {
      return { text: cleanText, title };
    }
  } catch (e) {
    // ignore
  }

  throw new Error(
    `Unsupported file format (${extension || "unknown"}). Please select a Word (.docx), PDF (.pdf), Text (.txt), or Markdown (.md) file.`
  );
}
