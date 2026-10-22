const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', 'src', 'lib');

let ref = fs.readFileSync(path.join(src, 'reference.raw.js'), 'utf8');
ref = ref.replace(
  /^\/\*[\s\S]*?\*\/\s*/,
  `import type { DiagnosisEntry, LabReference } from "./types";\n\n`
);
ref = ref.replace('const LAB_REFERENCE = [', 'export const LAB_REFERENCE: LabReference[] = [');
ref = ref.replace('const COMMON_MEDICINES = [', 'export const COMMON_MEDICINES: string[] = [');
ref = ref.replace('const DIAGNOSIS_MAP = [', 'export const DIAGNOSIS_MAP: DiagnosisEntry[] = [');
fs.writeFileSync(path.join(src, 'reference.ts'), ref, 'utf8');

let smp = fs.readFileSync(path.join(src, 'samples.raw.js'), 'utf8');
smp = smp.replace(/^\/\*[\s\S]*?\*\/\s*/, '');
smp = smp.replace('const SAMPLES = [', 'export interface SampleDoc {\n  id: string;\n  label: string;\n  text: string;\n}\n\nexport const SAMPLES: SampleDoc[] = [');
fs.writeFileSync(path.join(src, 'samples.ts'), smp, 'utf8');

for (const f of ['reference.raw.js', 'samples.raw.js']) fs.unlinkSync(path.join(src, f));
console.log('CONVERTED');
