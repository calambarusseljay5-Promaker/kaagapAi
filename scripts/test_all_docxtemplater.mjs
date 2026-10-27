import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

const templatesDir = path.resolve('public/files/document-templates');
const files = [
  'Cert.BUSINESS-Permit.docx',
  'Cert.Residency-Templates.docx',
  'Cert.indigency-templates.docx',
  'Cert.-solo-parent-Templates.docx',
  'Barangay-Cert.templates.-4ps.docx',
  'cert.Rsbsa-templates.docx',
  'cert.barangay-clearance.docx'
];

const mockData = {
  FULL_NAME: 'JUAN MIGUEL S. DELA CRUZ',
  AGE: '34',
  GENDER: 'Male',
  PREFIX: 'Mr.',
  CIVIL_STATUS: 'Married',
  PUROK: 'Kamonsil',
  ADDRESS: 'Purok Kamonsil, Upper Mingading, Aleosan, Cotabato',
  PURPOSE: 'Official Employment and Loan Verification',
  BUSINESS_NAME: 'JUAN RETAIL STORE',
  CROPS_DETAILS: 'Corn 1 hectare and Rice 2 hectares',
  FARM_SIZE: 'Three (3) hectares',
  SOLO_PARENT_REASON: 'death of spouse',
  DATE_OF_BIRTH: 'May 12, 1992',
  DAY: '8th',
  MONTH: 'September',
  YEAR: '2026',
  DATE: 'September 8, 2026',
  BARANGAY_CAPTAIN: 'HON. MAMERTO C. CLARITO',
  OR_NUMBER: 'OR-2026-99182',
  CTC_NUMBER: 'CTC-002819',
  DATE_ISSUED: '09-08-2026'
};

let allPassed = true;

for (const f of files) {
  const fpath = path.join(templatesDir, f);
  try {
    const content = fs.readFileSync(fpath);
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{{', end: '}}' }
    });
    
    doc.render(mockData);
    
    const buf = doc.getZip().generate({ type: 'nodebuffer' });
    console.log(`[PASS] ${f} - Generated ${buf.length} bytes successfully!`);
  } catch (err) {
    console.error(`[FAIL] ${f}:`, err.message || err);
    if (err.properties && err.properties.errors) {
      console.error(JSON.stringify(err.properties.errors, null, 2));
    }
    allPassed = false;
  }
}

if (allPassed) {
  console.log('\n>>> ALL 7 TEMPLATES COMPILED & RENDERED PERFECTLY! <<<');
} else {
  process.exit(1);
}
