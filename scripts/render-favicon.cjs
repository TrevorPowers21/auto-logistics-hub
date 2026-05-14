const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const svg = fs.readFileSync(
  path.join(__dirname, "..", "public", "favicon.svg"),
  "utf-8"
);

const sizes = [
  { w: 32, h: 32, out: "favicon-32.png", copyTo: "favicon.ico" },
  { w: 180, h: 180, out: "apple-touch-icon.png" },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const s of sizes) {
    const sized = svg.replace(
      /<svg([^>]*)>/,
      `<svg$1 width="${s.w}" height="${s.h}">`
    );
    const html = `<!doctype html><html><body style="margin:0;padding:0;background:transparent">${sized}</body></html>`;
    await page.setViewportSize({ width: s.w, height: s.h });
    await page.setContent(html, { waitUntil: "load" });
    const out = path.join(__dirname, "..", "public", s.out);
    await page.screenshot({
      path: out,
      clip: { x: 0, y: 0, width: s.w, height: s.h },
      omitBackground: true,
      type: "png",
    });
    console.log(`wrote ${out}`);
    if (s.copyTo) {
      const copyPath = path.join(__dirname, "..", "public", s.copyTo);
      fs.copyFileSync(out, copyPath);
      console.log(`copied to ${copyPath}`);
    }
  }
  await browser.close();
})();
