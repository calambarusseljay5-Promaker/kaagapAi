import os
import zipfile
import re
import xml.etree.ElementTree as ET

ORIGINALS_DIR = r"public\files\document-templates\originals"
TARGET_DIR = r"public\files\document-templates"

NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
ET.register_namespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
ET.register_namespace('w14', 'http://schemas.microsoft.com/office/word/2010/wordml')

def process_business_permit():
    fname = "Cert.BUSINESS-Permit.docx"
    src = os.path.join(ORIGINALS_DIR, fname)
    dst = os.path.join(TARGET_DIR, fname)
    
    with zipfile.ZipFile(src, 'r') as zin:
        xml_str = zin.read('word/document.xml').decode('utf-8')
        
        # Replace resident name blank (run of spaces with underline) with {{FULL_NAME}}
        # P12: certify that ... 51 yrs. old ... single/married/widow ... Purok Azucena ... BANANA BUY AND SALE
        xml_str = xml_str.replace('<w:t xml:space="preserve">      </w:t>', '<w:t>{{FULL_NAME}}</w:t>')
        xml_str = xml_str.replace('<w:t>51</w:t>', '<w:t>{{AGE}}</w:t>')
        xml_str = xml_str.replace('<w:t>single</w:t>', '<w:t>{{CIVIL_STATUS}}</w:t>')
        xml_str = xml_str.replace('<w:t>/</w:t><w:r', '<w:t></w:t><w:r')
        xml_str = xml_str.replace('<w:t>married</w:t>', '<w:t></w:t>')
        xml_str = xml_str.replace('<w:t>widow, a bona</w:t>', '<w:t>, a bona</w:t>')
        xml_str = xml_str.replace('<w:t>Azucena</w:t>', '<w:t>{{PUROK}}</w:t>')
        xml_str = xml_str.replace('<w:t>BANANA BUY AND SALE</w:t>', '<w:t>{{BUSINESS_NAME}}</w:t>')
        
        # P14: purpose
        xml_str = xml_str.replace('<w:t>Business </w:t>', '<w:t>{{PURPOSE}}</w:t>')
        xml_str = xml_str.replace('<w:t>Permit </w:t>', '<w:t></w:t>')
        xml_str = xml_str.replace('<w:t>Application</w:t>', '<w:t></w:t>')
        
        # P16: date
        xml_str = xml_str.replace('<w:t>August</w:t>', '<w:t>{{MONTH}}</w:t>')
        xml_str = xml_str.replace('<w:t> 202</w:t>', '<w:t xml:space="preserve"> </w:t>')
        xml_str = xml_str.replace('<w:t>5</w:t>', '<w:t>{{YEAR}}</w:t>')
        # For day: replace spaces after Issued this
        xml_str = xml_str.replace('<w:t>Issued this </w:t><w:r><w:rPr><w:rFonts w:ascii="Rockwell Condensed" w:hAnsi="Rockwell Condensed"/><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/><w:u w:val="single"/></w:rPr><w:t xml:space="preserve">  </w:t></w:r>',
                                  '<w:t>Issued this </w:t><w:r><w:rPr><w:rFonts w:ascii="Rockwell Condensed" w:hAnsi="Rockwell Condensed"/><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/><w:u w:val="single"/></w:rPr><w:t>{{DAY}}</w:t></w:r>')
        
        # P20: Captain
        xml_str = xml_str.replace('<w:t>MAMERTO C. CLARITO</w:t>', '<w:t>{{BARANGAY_CAPTAIN}}</w:t>')
        
        # P24/P25: OR No and Date Issued
        xml_str = xml_str.replace('<w:t>OR No.       ________</w:t>', '<w:t>OR No.       {{OR_NUMBER}}</w:t>')
        xml_str = xml_str.replace('<w:t>Date Issued:   ________</w:t>', '<w:t>Date Issued:   {{DATE_ISSUED}}</w:t>')
        
        # Write to destination
        with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                if item.filename == 'word/document.xml':
                    zout.writestr(item, xml_str.encode('utf-8'))
                else:
                    zout.writestr(item, zin.read(item.filename))
                    
    print(f"Processed {fname}")

process_business_permit()
