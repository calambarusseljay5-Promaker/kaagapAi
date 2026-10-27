import os
import zipfile
import xml.etree.ElementTree as ET

ORIGINALS_DIR = r"public\files\document-templates\originals"
TARGET_DIR = r"public\files\document-templates"

NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
ET.register_namespace('w', NS)
ET.register_namespace('w14', "http://schemas.microsoft.com/office/word/2010/wordml")
ET.register_namespace('r', "http://schemas.openxmlformats.org/officeDocument/2006/relationships")

def get_t_nodes(p):
    return p.findall(f'.//{{{NS}}}t')

def process_file(fname, tagger_fn):
    src = os.path.join(ORIGINALS_DIR, fname)
    dst = os.path.join(TARGET_DIR, fname)
    
    with zipfile.ZipFile(src, 'r') as zin:
        tree = ET.fromstring(zin.read('word/document.xml'))
        paras = tree.findall(f'.//{{{NS}}}p')
        
        tagger_fn(paras)
        
        new_xml = ET.tostring(tree, encoding='utf-8')
        
        with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                if item.filename == 'word/document.xml':
                    zout.writestr(item, new_xml)
                else:
                    zout.writestr(item, zin.read(item.filename))
    print(f"Tagged {fname} successfully.")

# 1. Business Permit
def tag_business_permit(paras):
    # P12: resident info
    nodes = get_t_nodes(paras[12])
    # 0: 'This is to certify that'
    # 2: '      ' -> name
    # 6: '51' -> age
    # 10: 'single' -> status
    # 11: '/', 12: 'married', 13: '/', 14: 'widow, a bona' -> status & rest
    # 17: 'Azucena' -> purok
    # 24: 'BANANA BUY AND SALE' -> business
    for n in nodes:
        if n.text and '      ' in n.text:
            n.text = '{{FULL_NAME}}'
        elif n.text == '51':
            n.text = '{{AGE}}'
        elif n.text == 'single':
            n.text = '{{CIVIL_STATUS}}'
        elif n.text == 'married':
            n.text = ''
        elif n.text and 'widow, a bona' in n.text:
            n.text = ', a bona'
        elif n.text == 'Azucena':
            n.text = '{{PUROK}}'
        elif n.text and 'BANANA BUY AND SALE' in n.text:
            n.text = '{{BUSINESS_NAME}}'
            
    # P14: purpose
    nodes = get_t_nodes(paras[14])
    for n in nodes:
        if n.text and 'Business ' in n.text:
            n.text = '{{PURPOSE}} '
        elif n.text in ['Permit ', 'Application']:
            n.text = ''
            
    # P16: date
    nodes = get_t_nodes(paras[16])
    found_day = False
    for n in nodes:
        if not found_day and n.text and n.text.strip() == '':
            n.text = '{{DAY}} '
            found_day = True
        elif n.text == 'August':
            n.text = '{{MONTH}}'
        elif n.text and '202' in n.text:
            n.text = ' '
        elif n.text == '5':
            n.text = '{{YEAR}}'
            
    # P20: Captain
    nodes = get_t_nodes(paras[20])
    for n in nodes:
        if 'MAMERTO C. CLARITO' in (n.text or ''):
            n.text = n.text.replace('MAMERTO C. CLARITO', '{{BARANGAY_CAPTAIN}}')
            
    # P24: OR No
    if len(paras) > 24:
        for n in get_t_nodes(paras[24]):
            if '________' in (n.text or ''):
                n.text = n.text.replace('________', '{{OR_NUMBER}}')
    # P25: Date Issued
    if len(paras) > 25:
        for n in get_t_nodes(paras[25]):
            if '________' in (n.text or ''):
                n.text = n.text.replace('________', '{{DATE_ISSUED}}')

# 2. Residency
def tag_residency(paras):
    # P13
    nodes = get_t_nodes(paras[13])
    for n in nodes:
        if 'RONIE' in (n.text or ''):
            n.text = ' {{FULL_NAME}}'
        elif 'T. CAJEBEN JR.' in (n.text or ''):
            n.text = ','
        elif n.text == 'male':
            n.text = '{{GENDER}}'
        elif n.text and '/female, ' in n.text:
            n.text = ', '
        elif n.text == 'single':
            n.text = '{{CIVIL_STATUS}}'
        elif n.text == 'married':
            n.text = ''
        elif 'February 13, 2001' in (n.text or ''):
            n.text = n.text.replace('February 13, 2001', '{{DATE_OF_BIRTH}}')
        elif n.text == 'Buklod':
            n.text = '{{PUROK}}'
        elif 'for a CAFGU' in (n.text or ''):
            n.text = n.text.replace('for a CAFGU', '{{PURPOSE}}')

    # P17: Date
    nodes = get_t_nodes(paras[17])
    for n in nodes:
        if '22' in (n.text or ''):
            n.text = ' {{DAY}}'
        elif n.text == 'nd':
            n.text = ''
        elif 'August' in (n.text or ''):
            n.text = ' {{MONTH}} {{YEAR}} '

    # P19: Captain
    nodes = get_t_nodes(paras[19])
    for n in nodes:
        if 'MAMERTO C. CLARITO' in (n.text or ''):
            n.text = n.text.replace('MAMERTO C. CLARITO', '{{BARANGAY_CAPTAIN}}')
            
    # Bottom OR / CTC
    for p in paras[21:]:
        for n in get_t_nodes(p):
            if 'O. R. No' in (n.text or ''):
                n.text = 'O. R. No:     {{OR_NUMBER}}'
            elif 'CTC No.' in (n.text or ''):
                n.text = 'CTC No.:      {{CTC_NUMBER}}'
            elif 'Date Issued:' in (n.text or ''):
                n.text = 'Date Issued:  {{DATE_ISSUED}}'

# 3. Indigency
def tag_indigency(paras):
    # P14
    nodes = get_t_nodes(paras[14])
    found_name = False
    for n in nodes:
        if not found_name and n.text and '   ' in n.text:
            n.text = '{{FULL_NAME}}'
            found_name = True
        elif n.text and '18' in n.text:
            n.text = '{{AGE}} '
        elif n.text == 'single':
            n.text = '{{CIVIL_STATUS}}'
        elif n.text == 'married':
            n.text = ''
        elif n.text and '/Widow and a' in n.text:
            n.text = ' and a '
        elif n.text == 'Buklod':
            n.text = '{{PUROK}}'

    # P15: purpose
    nodes = get_t_nodes(paras[15])
    for n in nodes:
        if 'person  and' in (n.text or ''):
            n.text = n.text.replace('person  and', 'person for {{PURPOSE}} and')

    # P16: date
    nodes = get_t_nodes(paras[16])
    found_day = False
    for n in nodes:
        if not found_day and n.text and '     ' in n.text:
            n.text = '{{DAY}}'
            found_day = True
        elif n.text == '_':
            n.text = '{{MONTH}} {{YEAR}}'

    # P18: Captain
    nodes = get_t_nodes(paras[18])
    for n in nodes:
        if 'MAMERTO C. CLARITO' in (n.text or ''):
            n.text = '{{BARANGAY_CAPTAIN}}'
            
    # Bottom details
    for p in paras[20:]:
        for n in get_t_nodes(p):
            if 'O. R. No.' in (n.text or ''):
                n.text = 'O. R. No.     {{OR_NUMBER}}'
            elif 'CTC No.' in (n.text or ''):
                n.text = 'CTC No.      {{CTC_NUMBER}}'
            elif 'Date Issued:' in (n.text or ''):
                n.text = 'Date Issued:  {{DATE_ISSUED}}'

# 4. Solo Parent
def tag_solo_parent(paras):
    # P11
    nodes = get_t_nodes(paras[11])
    found_name = False
    for n in nodes:
        if not found_name and n.text and '     ' in n.text:
            n.text = '{{FULL_NAME}} '
            found_name = True
        elif n.text == 'single':
            n.text = '{{CIVIL_STATUS}}'
        elif n.text in ['married', 'widow', 'separated']:
            n.text = ''
        elif n.text == 'Muslim':
            n.text = '{{PUROK}}'

    # P13: Reason
    nodes = get_t_nodes(paras[13])
    for n in nodes:
        if 'due to ' in (n.text or ''):
            n.text = 'due to {{SOLO_PARENT_REASON}} '
        elif 'death of h' in (n.text or '') or n.text in ['er', 'husband']:
            n.text = ''

    # P15: Date
    nodes = get_t_nodes(paras[15])
    found_day = False
    for n in nodes:
        if not found_day and (n.text == '2' or n.text == '20th'):
            n.text = '{{DAY}}'
            found_day = True
        elif n.text in ['0', 'th']:
            n.text = ''
        elif n.text and '           ' in n.text:
            n.text = '{{MONTH}} {{YEAR}} '

    # P18: Captain
    nodes = get_t_nodes(paras[18])
    for n in nodes:
        if 'MAMERTO C. CLARITO' in (n.text or ''):
            n.text = n.text.replace('MAMERTO C. CLARITO', '{{BARANGAY_CAPTAIN}}')

# 5. 4Ps Certification
def tag_4ps(paras):
    # P11
    nodes = get_t_nodes(paras[11])
    found_name = False
    for n in nodes:
        if not found_name and n.text and '            ' in n.text:
            n.text = '{{FULL_NAME}}'
            found_name = True
        elif n.text and '35' in n.text:
            n.text = ' {{AGE}}'
        elif n.text and 'single' in n.text:
            n.text = ' {{CIVIL_STATUS}}'
        elif n.text and '/married' in n.text:
            n.text = ''
        elif n.text and '/widow' in n.text:
            n.text = ', a bona fide resident of  Purok '
        elif n.text and 'Muslim' in n.text:
            n.text = '{{PUROK}} '

    # P13: Purpose
    nodes = get_t_nodes(paras[13])
    for n in nodes:
        if 'Change Grantee' in (n.text or ''):
            n.text = '{{PURPOSE}} '
        elif 'working Abroad' in (n.text or ''):
            n.text = 'and for whatever'
        elif n.text and '           ' in n.text:
            n.text = ''

    # P15: Date
    nodes = get_t_nodes(paras[15])
    found_day = False
    for n in nodes:
        if not found_day and n.text and '       ' in n.text:
            n.text = '{{DAY}} '
            found_day = True
        elif n.text and 'November' in n.text:
            n.text = ' {{MONTH}}'
        elif n.text and '2023' in n.text:
            n.text = ' {{YEAR}}'

    # P18: Captain
    nodes = get_t_nodes(paras[18])
    for n in nodes:
        if 'MAMERTO C. CLARITO' in (n.text or ''):
            n.text = n.text.replace('MAMERTO C. CLARITO', '{{BARANGAY_CAPTAIN}}')

    # P22/23
    for p in paras[20:]:
        for n in get_t_nodes(p):
            if '2578557' in (n.text or ''):
                n.text = n.text.replace('2578557', '{{OR_NUMBER}}')
            elif '11-17-23' in (n.text or ''):
                n.text = n.text.replace('11-17-23', '{{DATE_ISSUED}}')

# 6. RSBSA
def tag_rsbsa(paras):
    # P11
    nodes = get_t_nodes(paras[11])
    found_name = False
    for n in nodes:
        if not found_name and n.text and '          ' in n.text:
            n.text = '{{FULL_NAME}} '
            found_name = True
        elif n.text == 'y':
            n.text = '{{AGE}} y'
        elif 'residing at   ' in (n.text or ''):
            n.text = 'residing at {{ADDRESS}}, '
        elif n.text and 'Rice Field' in n.text:
            n.text = '{{CROPS_DETAILS}}'
        elif n.text in ['and ', 'Fruits Crops 1 hectare']:
            n.text = ''
        elif n.text and '     ' in n.text:
            n.text = '{{PUROK}}'
        elif 'One  (' in (n.text or ''):
            n.text = '{{FARM_SIZE}} ('

    # P16: Captain & Date
    nodes = get_t_nodes(paras[16])
    for n in nodes:
        if 'MAMERTO C. CLARITO' in (n.text or ''):
            n.text = n.text.replace('MAMERTO C. CLARITO', '{{BARANGAY_CAPTAIN}}')
        elif 'April 29, 2026' in (n.text or ''):
            n.text = n.text.replace('April 29, 2026', '{{DATE}}')

    # P22/P25
    for p in paras[20:]:
        for n in get_t_nodes(p):
            if 'April 29, 2026' in (n.text or ''):
                n.text = n.text.replace('April 29, 2026', '{{DATE}}')
            elif 'Farmers/Fisher' in (n.text or ''):
                n.text = '{{FULL_NAME}} (Farmer/Fisher)'

# 7. Barangay Clearance
def tag_clearance(paras):
    # P11
    nodes = get_t_nodes(paras[11])
    for n in nodes:
        if n.text == 'Ms.':
            n.text = '{{PREFIX}}'
        elif n.text in ['/Mr', '/Mrs']:
            n.text = ''
        elif n.text and '        ' in n.text:
            n.text = '{{FULL_NAME}}'
        elif n.text and '     ' in n.text:
            n.text = '{{AGE}}'
        elif n.text and 'single/' in n.text:
            n.text = '{{CIVIL_STATUS}}'
        elif n.text in ['maried', '/']:
            n.text = ''
        elif n.text and '/widow' in n.text:
            n.text = ', whose signature   and thumbmark appear below is    presently   a   resident of '
        elif n.text and '      ' in n.text:
            n.text = '{{PUROK}} '

    # P18: Purpose
    nodes = get_t_nodes(paras[18])
    for n in nodes:
        if 'OWWA' in (n.text or ''):
            n.text = '{{PURPOSE}} '

    # P20: Date
    nodes = get_t_nodes(paras[20])
    for n in nodes:
        if 'day' in (n.text or ''):
            n.text = ' {{DAY}} day'
        elif '     _' in (n.text or ''):
            n.text = ' {{MONTH}} {{YEAR}} '

    # P23: Captain
    nodes = get_t_nodes(paras[23])
    for n in nodes:
        if 'MAMERTO C. CLARITO' in (n.text or ''):
            n.text = n.text.replace('MAMERTO C. CLARITO', '{{BARANGAY_CAPTAIN}}')

    # P27: Name signature
    if len(paras) > 27:
        for n in get_t_nodes(paras[27]):
            if 'FATMAH S. SUMPAO' in (n.text or ''):
                n.text = n.text.replace('FATMAH S. SUMPAO', '{{FULL_NAME}}')

    # Bottom OR / CTC
    for p in paras[30:]:
        for n in get_t_nodes(p):
            if 'O. R.  No.' in (n.text or ''):
                n.text = 'O. R.  No.     {{OR_NUMBER}}'
            elif 'CTC. No.' in (n.text or ''):
                n.text = 'CTC. No.       {{CTC_NUMBER}}'
            elif 'Date Issued:' in (n.text or ''):
                n.text = 'Date Issued:  {{DATE_ISSUED}}'

process_file("Cert.BUSINESS-Permit.docx", tag_business_permit)
process_file("Cert.Residency-Templates.docx", tag_residency)
process_file("Cert.indigency-templates.docx", tag_indigency)
process_file("Cert.-solo-parent-Templates.docx", tag_solo_parent)
process_file("Barangay-Cert.templates.-4ps.docx", tag_4ps)
process_file("cert.Rsbsa-templates.docx", tag_rsbsa)
process_file("cert.barangay-clearance.docx", tag_clearance)

print("\n>>> ALL 7 TEMPLATES PROCESSED & READY! <<<")
