import zipfile
import xml.etree.ElementTree as ET
import glob
import os

files = glob.glob("public/files/document-templates/*.docx")

for file_path in sorted(files):
    fname = os.path.basename(file_path)
    print("\n" + "=" * 70)
    print("TEMPLATE:", fname)
    print("=" * 70)
    with zipfile.ZipFile(file_path) as z:
        doc_xml = z.read("word/document.xml")
        root = ET.fromstring(doc_xml)
        ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
        
        paragraphs = []
        for p in root.iter(f"{{{ns['w']}}}p"):
            p_text = ""
            runs = []
            for r in p.iter(f"{{{ns['w']}}}r"):
                t_nodes = [node.text for node in r.iter(f"{{{ns['w']}}}t") if node.text]
                t = "".join(t_nodes)
                if not t:
                    continue
                p_text += t
                rPr = r.find(f"{{{ns['w']}}}rPr")
                font_name = None
                font_sz = None
                is_bold = False
                is_underline = False
                if rPr is not None:
                    rFonts = rPr.find(f"{{{ns['w']}}}rFonts")
                    if rFonts is not None:
                        font_name = rFonts.attrib.get(f"{{{ns['w']}}}ascii") or rFonts.attrib.get(f"{{{ns['w']}}}hAnsi")
                    sz = rPr.find(f"{{{ns['w']}}}sz")
                    if sz is not None:
                        font_sz = int(sz.attrib.get(f"{{{ns['w']}}}val", 0)) / 2
                    b = rPr.find(f"{{{ns['w']}}}b")
                    is_bold = b is not None
                    u = rPr.find(f"{{{ns['w']}}}u")
                    is_underline = u is not None
                runs.append({"text": t, "font": font_name, "size": font_sz, "bold": is_bold, "underline": is_underline})
            if p_text.strip():
                # Summarize unique fonts and sizes in this paragraph
                fonts_used = list(set([r['font'] for r in runs if r['font']]))
                sizes_used = list(set([r['size'] for r in runs if r['size']]))
                print(f"[{p_text.strip()[:40]:40}] => Fonts: {fonts_used} | Sizes: {sizes_used}")
                # If title or notable line, print full detail
                if any(k in p_text.upper() for k in ["CERTIFICATION", "CLEARANCE", "PERMIT", "INDIGENCY", "RESIDENCY", "SOLO", "RSBSA", "MAMERTO"]):
                    for r in runs:
                        if r['text'].strip():
                            print(f"     run: {repr(r['text'])} | Font: {r['font']} | {r['size']}pt | B:{r['bold']} | U:{r['underline']}")
