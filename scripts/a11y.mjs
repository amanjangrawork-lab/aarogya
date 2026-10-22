import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const url = process.argv[2] || "http://127.0.0.1:4310";
const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);

async function run(label) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const violations = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
    count: v.nodes.length,
  }));
  console.log(`\n=== ${label} — ${violations.length} violation type(s) ===`);
  console.log(JSON.stringify(violations, null, 2));
  return violations;
}

await run("landing");

// Now the app section with a record loaded.
await page.evaluate(() => {
  const el = document.querySelector("#app");
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: "instant" });
});
await page.waitForTimeout(1200);
await page.getByRole("button", { name: "Load example" }).click();
await page.waitForTimeout(3000);
await run("review gate");

const confirm = page.getByRole("button", { name: /Confirm/ });
if (await confirm.count()) {
  await confirm.first().click();
  await page.waitForTimeout(1500);
}
await run("summary");

await browser.close();
process.exit(0);
