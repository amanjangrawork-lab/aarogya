import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:4310";
const outDir = process.argv[3] || "shots";

const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text().slice(0, 260));
});
page.on("pageerror", (e) => errors.push("PAGEERROR: " + String(e).slice(0, 260)));

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(4000);

const hasCanvas = await page.locator("canvas").count();
const canvasSize = hasCanvas
  ? await page.locator("canvas").first().evaluate((c) => ({ w: c.width, h: c.height }))
  : null;

await page.screenshot({ path: `${outDir}/01-hero.png` });

const height = await page.evaluate(() => document.body.scrollHeight);
const steps = [0.16, 0.34, 0.52, 0.7, 0.88];
for (let i = 0; i < steps.length; i++) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), height * steps[i]);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${outDir}/0${i + 2}-act-${Math.round(steps[i] * 100)}.png` });
}

// Mobile pass
const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
await mobile.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
await mobile.waitForTimeout(3500);
await mobile.screenshot({ path: `${outDir}/06-mobile.png` });

const mobileOverflow = await mobile.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);

console.log(
  JSON.stringify(
    { hasCanvas, canvasSize, mobileOverflow, errors: errors.slice(0, 10) },
    null,
    2,
  ),
);

await browser.close();
process.exit(0);
