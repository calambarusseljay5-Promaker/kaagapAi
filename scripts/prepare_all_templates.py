import os
import zipfile
import re

ORIGINALS_DIR = r"public\files\document-templates\originals"
TARGET_DIR = r"public\files\document-templates"

def update_docx(fname, replacers):
    src = os.path.join(ORIGINALS_DIR, fname)
    dst = os.path.join(TARGET_DIR, fname)
    
    with zipfile.ZipFile(src, 'r') as zin:
        xml_str = zin.read('word/document.xml').decode('utf-8')
        
        for old, new in replacers:
            if old in xml_str:
                xml_str = xml_str.replace(old, new)
            else:
                print(f"  [WARN] Pattern not found in {fname}: {repr(old)[:60]}")
                
        with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                if item.filename == 'word/document.xml':
                    zout.writestr(item, xml_str.encode('utf-8'))
                else:
                    zout.writestr(item, zin.read(item.filename))
                    
    print(f"[OK] Processed {fname}")

# 1. Business Permit
update_docx("Cert.BUSINESS-Permit.docx", [
    ('<w:t xml:space="preserve">      </w:t>', '<w:t>{{FULL_NAME}}</w:t>'),
    ('<w:t>51</w:t>', '<w:t>{{AGE}}</w:t>'),
    ('<w:t>single</w:t>', '<w:t>{{CIVIL_STATUS}}</w:t>'),
    ('<w:t>/</w:t><w:r pr:rsidR="00A50D83"', '<w:t></w:t><w:r pr:rsidR="00A50D83"'),
    ('<w:t>married</w:t>', '<w:t></w:t>'),
    ('<w:t>widow, a bona</w:t>', '<w:t>, a bona</w:t>'),
    ('<w:t>Azucena</w:t>', '<w:t>{{PUROK}}</w:t>'),
    ('<w:t>BANANA BUY AND SALE</w:t>', '<w:t>{{BUSINESS_NAME}}</w:t>'),
    ('<w:t>Business </w:t>', '<w:t>{{PURPOSE}}</w:t>'),
    ('<w:t>Permit </w:t>', '<w:t></w:t>'),
    ('<w:t>Application</w:t>', '<w:t></w:t>'),
    ('<w:t>August</w:t>', '<w:t>{{MONTH}}</w:t>'),
    ('<w:t> 202</w:t>', '<w:t xml:space="preserve"> </w:t>'),
    ('<w:t>5</w:t>', '<w:t>{{YEAR}}</w:t>'),
    ('<w:t xml:space="preserve">        </w:t><w:t>day of</w:t>', '<w:t>{{DAY}}</w:t><w:t xml:space="preserve"> day of</w:t>'),
    ('MAMERTO C. CLARITO', '{{BARANGAY_CAPTAIN}}'),
    ('OR No.       ________', 'OR No.       {{OR_NUMBER}}'),
    ('Date Issued:   ________', 'Date Issued:   {{DATE_ISSUED}}'),
])

# 2. 4Ps Certification
update_docx("Barangay-Cert.templates.-4ps.docx", [
    ('<w:t xml:space="preserve">            </w:t>', '<w:t>{{FULL_NAME}}</w:t>'),
    ('<w:t> 35</w:t>', '<w:t xml:space="preserve"> {{AGE}}</w:t>'),
    ('<w:t>single</w:t>', '<w:t>{{CIVIL_STATUS}}</w:t>'),
    ('<w:t>/married</w:t>', '<w:t></w:t>'),
    ('<w:t>/widow, a bona fide resident of  Purok </w:t>', '<w:t>, a bona fide resident of  Purok </w:t>'),
    ('<w:t>Muslim </w:t>', '<w:t>{{PUROK}} </w:t>'),
    ('<w:t>Change Grantee of her wife </w:t>', '<w:t>{{PURPOSE}}</w:t>'),
    ('<w:t xml:space="preserve">           </w:t>', '<w:t></w:t>'),
    ('<w:t>working Abroad and for whatever</w:t>', '<w:t>and for whatever</w:t>'),
    ('<w:t> November</w:t>', '<w:t xml:space="preserve"> {{MONTH}}</w:t>'),
    ('<w:t xml:space="preserve">  2023</w:t>', '<w:t xml:space="preserve"> {{YEAR}}</w:t>'),
    ('<w:t xml:space="preserve">       </w:t>', '<w:t>{{DAY}}</w:t>'),
    ('MAMERTO C. CLARITO', '{{BARANGAY_CAPTAIN}}'),
    ('2578557', '{{OR_NUMBER}}'),
    ('11-17-23', '{{DATE_ISSUED}}'),
])

# 3. Solo Parent
update_docx("Cert.-solo-parent-Templates.docx", [
    ('<w:t xml:space="preserve">              </w:t>', '<w:t>{{FULL_NAME}}</w:t>'),
    ('<w:t>single</w:t>', '<w:t>{{CIVIL_STATUS}}</w:t>'),
    ('<w:t>/married</w:t>', '<w:t></w:t>'),
    ('<w:t>/widow</w:t>', '<w:t></w:t>'),
    ('<w:t>/separated</w:t>', '<w:t></w:t>'),
    ('<w:t>Muslim</w:t>', '<w:t>{{PUROK}}</w:t>'),
    ('<w:t>death of h</w:t>', '<w:t>{{SOLO_PARENT_REASON}}</w:t>'),
    ('<w:t>er</w:t>', '<w:t></w:t>'),
    ('<w:t>husband</w:t>', '<w:t></w:t>'),
    ('<w:t>2</w:t><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t>0</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t>th</w:t></w:r>',
     '<w:t>{{DAY}}</w:t>'),
    ('<w:t xml:space="preserve">           </w:t>', '<w:t>{{MONTH}} {{YEAR}} </w:t>'),
    ('MAMERTO C. CLARITO', '{{BARANGAY_CAPTAIN}}'),
])

# 4. Indigency
update_docx("Cert.indigency-templates.docx", [
    ('<w:t xml:space="preserve">                   </w:t>', '<w:t>{{FULL_NAME}}</w:t>'),
    ('<w:t>18 </w:t>', '<w:t>{{AGE}} </w:t>'),
    ('<w:t>single</w:t>', '<w:t>{{CIVIL_STATUS}}</w:t>'),
    ('<w:t>/married</w:t>', '<w:t></w:t>'),
    ('<w:t>/Widow and a </w:t>', '<w:t> and a </w:t>'),
    ('<w:t>Buklod</w:t>', '<w:t>{{PUROK}}</w:t>'),
    ('<w:t xml:space="preserve">person  and</w:t>', '<w:t xml:space="preserve">person for {{PURPOSE}} and</w:t>'),
    ('<w:t xml:space="preserve">     </w:t>', '<w:t>{{DAY}}</w:t>'),
    ('<w:t>_</w:t>', '<w:t>{{MONTH}} {{YEAR}}</w:t>'),
    ('MAMERTO C. CLARITO', '{{BARANGAY_CAPTAIN}}'),
    ('O. R. No.     ______', 'O. R. No.     {{OR_NUMBER}}'),
    ('CTC No.      ______', 'CTC No.      {{CTC_NUMBER}}'),
    ('Date Issued:  ______', 'Date Issued:  {{DATE_ISSUED}}'),
])

# 5. Residency
update_docx("Cert.Residency-Templates.docx", [
    ('<w:t> RONIE</w:t>', '<w:t>{{FULL_NAME}}</w:t>'),
    ('<w:t> T. CAJEBEN JR.,</w:t>', '<w:t></w:t>'),
    ('<w:t>male</w:t>', '<w:t>{{GENDER}}</w:t>'),
    ('<w:t>/female, </w:t>', '<w:t>, </w:t>'),
    ('<w:t>single</w:t>', '<w:t>{{CIVIL_STATUS}}</w:t>'),
    ('<w:t>/married</w:t>', '<w:t></w:t>'),
    ('February 13, 2001', '{{DATE_OF_BIRTH}}'),
    ('<w:t>Buklod</w:t>', '<w:t>{{PUROK}}</w:t>'),
    ('for a CAFGU', '{{PURPOSE}}'),
    ('<w:t xml:space="preserve"> 22</w:t>', '<w:t xml:space="preserve"> {{DAY}}</w:t>'),
    ('<w:t>nd</w:t>', '<w:t></w:t>'),
    ('   August     2025   ', ' {{MONTH}} {{YEAR}} '),
    ('MAMERTO C. CLARITO', '{{BARANGAY_CAPTAIN}}'),
    ('O. R. No    ', 'O. R. No    {{OR_NUMBER}}'),
    ('CTC No.    ', 'CTC No.    {{CTC_NUMBER}}'),
    ('Date Issued:  ', 'Date Issued:  {{DATE_ISSUED}}'),
])

# 6. RSBSA
update_docx("cert.Rsbsa-templates.docx", [
    ('<w:t xml:space="preserve">          </w:t> <w:t>y</w:t>', '<w:t>{{FULL_NAME}} </w:t><w:t>{{AGE}} y</w:t>'),
    ('residing at   ', 'residing at {{ADDRESS}}'),
    ('<w:t xml:space="preserve">          </w:t>', '<w:t></w:t>'),
    ('Rice Field  hectare, ', '{{CROPS_DETAILS}}'),
    ('<w:t>and </w:t>', '<w:t></w:t>'),
    ('<w:t>Fruits Crops 1 hectare</w:t>', '<w:t></w:t>'),
    ('<w:t xml:space="preserve">     </w:t>', '<w:t>{{PUROK}}</w:t>'),
    ('One  (', '{{FARM_SIZE}} ('),
    ('MAMERTO C. CLARITO ', '{{BARANGAY_CAPTAIN}} '),
    ('April 29, 2026', '{{DATE}}'),
    ('Farmers/Fisher', '{{FULL_NAME}} (Farmer/Fisher)'),
])

# 7. Barangay Clearance
update_docx("cert.barangay-clearance.docx", [
    ('<w:t>Ms.</w:t>', '<w:t>{{PREFIX}}</w:t>'),
    ('<w:t>/Mr/Mrs</w:t>', '<w:t></w:t>'),
    ('<w:t xml:space="preserve">        </w:t>', '<w:t>{{FULL_NAME}}</w:t>'),
    ('<w:t xml:space="preserve">     </w:t>', '<w:t>{{AGE}}</w:t>'),
    ('<w:t>single/</w:t>', '<w:t>{{CIVIL_STATUS}}</w:t>'),
    ('<w:t>maried</w:t>', '<w:t></w:t>'),
    ('<w:t>/widow', '<w:t>'),
    ('<w:t xml:space="preserve">      </w:t><w:t>Upper </w:t>', '<w:t xml:space="preserve">{{PUROK}} </w:t><w:t>Upper </w:t>'),
    ('<w:t>OWWA  </w:t>', '<w:t>{{PURPOSE}} </w:t>'),
    ('<w:t>    day</w:t>', '<w:t xml:space="preserve"> {{DAY}} day</w:t>'),
    ('<w:t xml:space="preserve">     _</w:t>', '<w:t xml:space="preserve"> {{MONTH}} {{YEAR}} </w:t>'),
    ('MAMERTO C. CLARITO', '{{BARANGAY_CAPTAIN}}'),
    ('FATMAH S. SUMPAO', '{{FULL_NAME}}'),
    ('O. R.  No.     _________', 'O. R.  No.     {{OR_NUMBER}}'),
    ('CTC. No.       ________', 'CTC. No.       {{CTC_NUMBER}}'),
    ('Date Issued:  ________', 'Date Issued:  {{DATE_ISSUED}}'),
    ('Date Issued: _________', 'Date Issued: {{DATE_ISSUED}}'),
])

print("ALL TEMPLATES TAGGED SUCCESSFULLY!")
