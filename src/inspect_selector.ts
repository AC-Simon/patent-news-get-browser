
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false }); // Show browser for debugging
  const page = await browser.newPage();
  
  try {
    const url = 'http://www.cnautonews.com/chanpin/list_162_1.html';
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    
    // Inspect list page
    console.log('Inspecting List Page...');
    
    // Dump body HTML
    const bodyHtml = await page.content();
    console.log('Body HTML length:', bodyHtml.length);
    console.log('Body HTML snippet (first 2000 chars):');
    console.log(bodyHtml.substring(0, 2000));
    
    // Look for any text that looks like a title from the site
    // E.g. search for a known keyword if possible, or just print all H1/H2/H3
    const headings = await page.$$eval('h1, h2, h3, h4', els => els.map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim(),
        class: el.className
    })).slice(0, 20));
    console.log('Headings:', headings);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // await browser.close();
    // Keep open for manual inspection if needed, or close
    await browser.close();
  }
})();
