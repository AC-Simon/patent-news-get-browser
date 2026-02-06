// @ts-nocheck
import { chromium, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 自动生成网站配置的工具
 * 用法: npx ts-node src/config_generator.ts <url>
 */

interface GeneratedConfig {
  name: string;
  baseUrl: string;
  url: string;
  listPage: {
    articleSelector: string;
    titleSelector: string;
    linkSelector: string;
    dateSelector?: string;
    descriptionSelector?: string;
  };
  detailPage: {
    titleSelector: string;
    contentSelector: string;
    authorSelector?: string;
    dateSelector?: string;
    useReadability: boolean;
  };
  pagination: {
    enabled: boolean;
    maxPages: number;
    urlPattern?: string;
    startPage: number;
  };
  delay: number;
  maxArticles: number;
  enabled: boolean;
}

async function main() {
  const url = process.argv[2] || 'http://www.cnautonews.com/chanpin/list_162_1.html'; // Default for testing
  
  if (!url) {
    console.error('Please provide a URL: npx ts-node src/config_generator.ts <url>');
    process.exit(1);
  }

  console.log(`Starting config generation for: ${url}`);
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  // Debug page console
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  try {
    // 1. Analyze List Page
    console.log('\nAnalyzing List Page...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000); // Wait for dynamic content

    const listConfig = await analyzeListPage(page);
    console.log('List Page Analysis Result:', listConfig);

    if (!listConfig.articleSelector) {
      throw new Error('Could not identify article list structure.');
    }

    // 2. Analyze Detail Page
    console.log('\nAnalyzing Detail Page...');
    let detailConfig = {
      titleSelector: 'h1',
      contentSelector: 'article',
      authorSelector: '',
      dateSelector: '',
      useReadability: false
    };

    if (listConfig.sampleUrl) {
      try {
        await page.goto(listConfig.sampleUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);
        detailConfig = await analyzeDetailPage(page);
        console.log('Detail Page Analysis Result:', detailConfig);
      } catch (e) {
        console.error('Failed to analyze detail page:', e);
      }
    }

    // 3. Generate Final Config
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const name = domain.replace('www.', '').split('.')[0]; // Simple name guess

    const finalConfig: GeneratedConfig = {
      name: name.charAt(0).toUpperCase() + name.slice(1),
      baseUrl: urlObj.origin,
      url: url,
      listPage: {
        articleSelector: listConfig.articleSelector,
        titleSelector: listConfig.titleSelector,
        linkSelector: listConfig.linkSelector,
        dateSelector: listConfig.dateSelector || undefined,
        descriptionSelector: listConfig.descriptionSelector || undefined
      },
      detailPage: {
        titleSelector: detailConfig.titleSelector,
        contentSelector: detailConfig.contentSelector,
        authorSelector: detailConfig.authorSelector || undefined,
        dateSelector: detailConfig.dateSelector || undefined,
        useReadability: detailConfig.useReadability
      },
      pagination: {
        enabled: true,
        maxPages: 5,
        urlPattern: url.replace(/\d+/, '{page}'), // Very naive guess, user should check
        startPage: 1
      },
      delay: 2000,
      maxArticles: 5,
      enabled: true
    };

    // 4. Save to file
    const outputDir = path.join(process.cwd(), 'config', 'websites');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = path.join(outputDir, `${name}_generated.json`);
    fs.writeFileSync(outputPath, JSON.stringify(finalConfig, null, 2));
    
    console.log(`\nConfig generated successfully at: ${outputPath}`);
    console.log('Please review and adjust the configuration manually, especially pagination settings.');

  } catch (error) {
    console.error('Error generating config:', error);
  } finally {
    await browser.close();
  }
}

async function analyzeListPage(page: Page) {
  return await page.evaluate(() => {
    // Helper to get CSS selector path
    function getSelector(el: Element, root?: Element): string {
      if (!el || el === root) return '';
      
      const className = el.className.trim().split(/\s+/).filter(c => c && !c.startsWith('ng-') && !c.startsWith('v-')).join('.');
      if (className) return `.${className}`;
      
      if (el.id) return `#${el.id}`;
      
      return el.tagName.toLowerCase();
    }

    function getFullSelector(el: Element, root?: Element): string {
        let path = [];
        let current: Element | null = el;
        while (current && current !== root && current !== document.body) {
            path.unshift(getSelector(current));
            current = current.parentElement;
        }
        return path.join(' ');
    }

    // 1. Identify potential article containers based on class repetition
    console.log('Starting analysis...');
    const allElements = document.body.querySelectorAll('*');
    const classCounts: Record<string, number> = {};
    const classElements: Record<string, Element[]> = {};
    
    allElements.forEach(el => {
        const cls = el.className;
        if (cls && typeof cls === 'string') {
            const classes = cls.trim().split(/\s+/).filter(c => c && !c.startsWith('ng-') && !c.startsWith('v-'));
            classes.forEach(c => {
                const selector = `.${c}`;
                classCounts[selector] = (classCounts[selector] || 0) + 1;
                if (!classElements[selector]) classElements[selector] = [];
                classElements[selector].push(el);
            });
        }
    });
    console.log(`Found ${Object.keys(classCounts).length} unique classes.`);

    // Filter candidates: 
    // - Count between 5 and 100
    // - Must contain at least one <a> tag with text length > 5
    const candidates = Object.entries(classElements)
        .filter(([selector, elements]) => {
            const count = elements.length;
            if (count < 5 || count > 100) return false;
            
            // Check first few elements for link content
            const validItems = elements.slice(0, 5).filter(el => {
                const link = el.querySelector('a');
                const len = link?.textContent?.trim().length || 0;
                // console.log(`Checking ${selector}: link len ${len}`);
                return link && len > 5;
            });
            
            const isValid = validItems.length >= Math.min(elements.length, 5) * 0.5;
            if (isValid) console.log(`Candidate: ${selector}, count: ${count}`);
            return isValid;
        })
        .sort((a, b) => b[1].length - a[1].length);

    console.log(`Found ${candidates.length} valid candidates.`);

    if (candidates.length === 0) {
        return { articleSelector: '', titleSelector: '', linkSelector: '', sampleUrl: '' };
    }

    // Helper to try to extract info from a candidate set
    function extractFromCandidate(articleSelector: string, elements: Element[]) {
        // Try the first few elements until we find one that works well
        for (const el of elements.slice(0, 3)) {
            let titleSelector = '';
            let linkSelector = 'a';
            let dateSelector = '';
            let descriptionSelector = '';
            let sampleUrl = '';

            // Find Title & Link
            const links = Array.from(el.querySelectorAll('a'));
            const mainLink = links.sort((a, b) => (b.textContent?.trim().length || 0) - (a.textContent?.trim().length || 0))[0];
            
            if (mainLink) {
                sampleUrl = mainLink.href;
                
                const hTag = mainLink.closest('h1, h2, h3, h4, h5');
                if (hTag && el.contains(hTag)) {
                    if (hTag.className) {
                        titleSelector = hTag.tagName.toLowerCase() + '.' + hTag.className.trim().split(/\s+/)[0];
                    } else {
                        titleSelector = hTag.tagName.toLowerCase();
                    }
                    linkSelector = `${titleSelector} > a`;
                    if (!el.querySelector(linkSelector)) {
                        linkSelector = `${titleSelector} a`;
                    }
                } else {
                    if (mainLink.className) {
                        const linkClass = mainLink.className.trim().split(/\s+/)[0];
                        linkSelector = `a.${linkClass}`;
                        titleSelector = linkSelector;
                    } else {
                        // Use full selector but relative to article
                        // If link is direct child
                        if (mainLink.parentElement === el) {
                             linkSelector = 'a'; // or '> a'
                        } else {
                             // naive fallback
                             linkSelector = 'a';
                        }
                        titleSelector = linkSelector;
                    }
                }
            } else {
                continue; // No link found in this element, try next element
            }

            // Find Date
            const dateRegex = /\d{4}[-/年]\d{1,2}[-/月]\d{1,2}/;
            const allEls = el.querySelectorAll('*');
            for (const subEl of Array.from(allEls)) {
                if (dateRegex.test(subEl.textContent || '') && subEl.children.length === 0) {
                    // Try to get a specific class
                    if (subEl.className) {
                         dateSelector = `.${subEl.className.trim().split(/\s+/)[0]}`;
                    } else {
                         dateSelector = subEl.tagName.toLowerCase(); // potentially risky
                    }
                    break;
                }
            }

            // Find Description
            const pTags = Array.from(el.querySelectorAll('p, div'));
            const descTag = pTags.find(p => {
                const text = p.textContent?.trim() || '';
                return text.length > 20 && text !== mainLink?.textContent?.trim() && !p.contains(mainLink);
            });
            if (descTag) {
                 if (descTag.className) {
                     descriptionSelector = `.${descTag.className.trim().split(/\s+/)[0]}`;
                 } else {
                     descriptionSelector = descTag.tagName.toLowerCase();
                 }
            }

            // If we found a sampleUrl, we consider this a valid candidate
            if (sampleUrl) {
                return {
                    articleSelector,
                    titleSelector,
                    linkSelector,
                    dateSelector,
                    descriptionSelector,
                    sampleUrl
                };
            }
        }
        return null;
    }

    // Iterate through candidates to find the best one
    // We prioritize candidates that look like content lists (not purely layout)
    // But since we can't be sure, we just try them in order.
    
    for (const [selector, elements] of candidates) {
        console.log(`Trying candidate: ${selector}`);
        const result = extractFromCandidate(selector, elements);
        if (result && result.sampleUrl) {
            console.log(`Match found with ${selector}`);
            return result;
        }
    }

    return { articleSelector: '', titleSelector: '', linkSelector: '', sampleUrl: '' };
  });
}

async function analyzeDetailPage(page: Page) {
  return await page.evaluate(() => {
    function getSelector(el: Element): string {
        if (!el) return '';
        const className = el.className.trim().split(/\s+/).filter(c => c).join('.');
        if (className) return `.${className}`;
        if (el.id) return `#${el.id}`;
        return el.tagName.toLowerCase();
    }

    // 1. Find Title
    let titleSelector = 'h1';
    const h1 = document.querySelector('h1');
    if (h1) {
        titleSelector = 'h1' + (h1.className ? `.${h1.className.split(' ')[0]}` : '');
    }

    // 2. Find Content
    // Scoring system for divs/articles
    const candidates = Array.from(document.querySelectorAll('div, article, section'));
    let bestContent = { el: null as Element | null, score: 0 };

    candidates.forEach(el => {
        let score = 0;
        const text = el.textContent || '';
        
        // Base score on text length
        score += text.length;

        // Penalize for high link density (navigation/footer)
        const links = el.querySelectorAll('a');
        const linkTextLength = Array.from(links).reduce((acc, a) => acc + (a.textContent?.length || 0), 0);
        if (text.length > 0 && linkTextLength / text.length > 0.5) {
            score *= 0.1; 
        }

        // Boost for <p> tags
        const pTags = el.querySelectorAll('p');
        score += pTags.length * 50;

        if (score > bestContent.score) {
            bestContent = { el, score };
        }
    });

    const contentSelector = bestContent.el ? getSelector(bestContent.el) : 'body';

    // 3. Find Date/Author
    let dateSelector = '';
    let authorSelector = '';
    
    // Search in meta/info area (usually near title)
    const metaCandidates = Array.from(document.querySelectorAll('.meta, .info, .date, .time, .author'));
    
    // Regex for date
    const dateRegex = /\d{4}[-/年]\d{1,2}[-/月]\d{1,2}/;
    
    // Check common meta containers
    if (h1 && h1.parentElement) {
        // Look in siblings of H1
        const siblings = h1.parentElement.querySelectorAll('*');
        siblings.forEach(el => {
            if (dateRegex.test(el.textContent || '')) {
                dateSelector = getSelector(el);
            }
            if ((el.textContent || '').includes('者') || (el.className || '').includes('author')) {
                authorSelector = getSelector(el);
            }
        });
    }

    // Fallback global search if not found near title
    if (!dateSelector) {
        const dateEl = Array.from(document.querySelectorAll('*')).find(el => 
            dateRegex.test(el.textContent || '') && el.textContent!.length < 50
        );
        if (dateEl) dateSelector = getSelector(dateEl);
    }

    return {
        titleSelector,
        contentSelector,
        authorSelector,
        dateSelector,
        useReadability: false
    };
  });
}

main();
