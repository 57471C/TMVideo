const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();

  page.on('console', msg => console.log(msg.text()));

  await page.goto(`file://${__dirname}/perf.html`);
  await browser.close();
})();
