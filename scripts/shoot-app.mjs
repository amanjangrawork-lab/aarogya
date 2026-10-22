import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:4310";
const out = process.argv[3] || "shots/app";

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text().slice(0, 200));
});
page.on("pageerror", (e) => errors.push("PAGEERROR: " + String(e).slice(0, 200)));

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);

// Jump to the app section.
await page.evaluate(() => {
  const el = document.querySelector("#app");
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: "instant" });
});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/01-app-empty.png` });

// Load the example lab report.
const loadBtn = page.getByRole("button", { name: "Load example" });
await loadBtn.click();
await page.waitForTimeout(3500);
await page.screenshot({ path: `${out}/02-review.png` });

const reviewHeading = await page.locator("h3", { hasText: "Review before saving" }).count();
const summaryHeading = await page.locator("h3", { hasText: "What this record says" }).count();
console.log("reviewPanel:", reviewHeading, "summaryPanel:", summaryHeading);

// Confirm and save, then check the summary.
const confirm = page.getByRole("button", { name: /Confirm/ });
if (await confirm.count()) {
  await confirm.first().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${out}/03-summary.png` });
}

// Timeline
await page.getByRole("tab", { name: /Health timeline/ }).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/04-timeline.png` });

// FHIR
await page.getByRole("tab", { name: /ABHA & FHIR/ }).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/05-fhir.png` });

// Language switch
await page.getByRole("tab", { name: /Simple summary/ }).click();
await page.waitForTimeout(600);
await page.selectOption("select[aria-label='Interface language']", "hi");
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/06-hindi.png` });

console.log(JSON.stringify({ errors: errors.slice(0, 8) }, null, 2));
await browser.close();
process.exit(0);
