$lab = Get-Content ".\sample-data\02-lab-report.txt" -Raw
$body = @{ text = $lab; fileName = "02-lab-report.txt"; patientId = "patient-1" } | ConvertTo-Json -Depth 5
$r = Invoke-WebRequest -Uri "http://127.0.0.1:4310/api/extract" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 60 -UseBasicParsing
$j = $r.Content | ConvertFrom-Json
"ENGINE: $($j.engine)"
"MEDS: $($j.record.medicines.Count)  LABS: $($j.record.labs.Count)  DX: $($j.record.diagnoses.Count)"
"FHIR ENTRIES: $($j.fhir.entry.Count)  VALID: $($j.fhirValidation.valid)"
"STORAGE: $($j.storage.mode)"
"LAB SAMPLE:"
$j.record.labs | Select-Object -First 3 test, value, unit, flag, loinc | Format-Table -AutoSize
"MED SAMPLE:"
$j.record.medicines | Select-Object name, dosage, frequency, confidence | Format-Table -AutoSize
