const fs = require("fs");
const path = require("path");

const files = [
  "src/app/page.tsx",
  "src/app/globals.css",
  ...fs
    .readdirSync(path.join(__dirname, "..", "src", "components", "app"))
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => path.join("src", "components", "app", f)),
];

let changed = 0;
for (const rel of files) {
  const abs = path.join(__dirname, "..", rel);
  if (!fs.existsSync(abs)) continue;
  const before = fs.readFileSync(abs, "utf8");
  let after = before
    // slate-500 on a dark surface is ~4.0:1 — below WCAG AA for small text.
    .replace(/text-slate-500\b/g, "text-slate-400")
    // Small uppercase labels need more separation from the card surface.
    .replace(/text-\[11px\] uppercase tracking-\[0\.18em\] text-slate-400/g, "text-[11px] uppercase tracking-[0.18em] text-slate-300");
  if (after !== before) {
    fs.writeFileSync(abs, after, "utf8");
    changed++;
  }
}
console.log("FILES CHANGED:", changed);
