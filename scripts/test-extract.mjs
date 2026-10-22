import { readFileSync } from "node:fs";

const base = "http://127.0.0.1:4310";
const text = readFileSync("sample-data/02-lab-report.txt", "utf8");
console.log("INPUT CHARS:", text.length, "| head:", JSON.stringify(text.slice(0, 60)));

const res = await fetch(`${base}/api/extract`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text, fileName: "02-lab-report.txt", patientId: "patient-1" }),
});
const j = await res.json();
console.log("ENGINE:", j.engine);
console.log("MEDS:", j.record?.medicines?.length, "LABS:", j.record?.labs?.length, "DX:", j.record?.diagnoses?.length);
console.log("FHIR:", j.fhir?.entry?.length, "VALID:", j.fhirValidation?.valid);
console.log("LABS:", (j.record?.labs || []).map((l) => `${l.test}=${l.value}${l.unit} (${l.flag}) ${l.loinc}`).join(" | "));
console.log("REJECTED:", JSON.stringify(j.rejected));
