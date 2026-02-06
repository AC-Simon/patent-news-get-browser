import * as fs from 'fs';
import * as path from 'path';
import { Article, CrawlLog, IArticleRepository, ICrawlLogRepository } from './interfaces';

const DATA_DIR = path.join(process.cwd(), 'data');
const ARTICLES_FILE = path.join(DATA_DIR, 'articles.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');

// Helper to ensure dir exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Helper to read/write
function readJson<T>(file: string): T[] {
  ensureDataDir();
  if (!fs.existsSync(file)) return [];
  try {
    const content = fs.readFileSync(file, 'utf-8');
    return JSON.parse(content, (key, value) => {
      // Parse dates
      if (typeof value === 'string') {
        // ISO date with time
        if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
          return new Date(value);
        }
        // Simple date YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          return new Date(value);
        }
      }
      return value;
    });
  } catch (error) {
    console.error(`Failed to read ${file}:`, error);
    return [];
  }
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function convertDatesToStrings(obj: any): any {
  if (obj instanceof Date) return formatDate(obj);
  if (Array.isArray(obj)) return obj.map(convertDatesToStrings);
  if (typeof obj === 'object' && obj !== null) {
    const newObj: any = {};
    for (const key in obj) {
      newObj[key] = convertDatesToStrings(obj[key]);
    }
    return newObj;
  }
  return obj;
}

function writeJson<T>(file: string, data: T[]): void {
  ensureDataDir();
  const dataToSave = convertDatesToStrings(data);
  fs.writeFileSync(file, JSON.stringify(dataToSave, null, 2));
}

/**
 * JSON文件文章Repository实现
 */
export class JsonArticleRepository implements IArticleRepository {
  async existsByUrl(url: string): Promise<boolean> {
    const articles = readJson<Article>(ARTICLES_FILE);
    return articles.some(a => a.url === url);
  }
  
  async findByUrl(url: string): Promise<Article | null> {
    const articles = readJson<Article>(ARTICLES_FILE);
    return articles.find(a => a.url === url) || null;
  }

  async saveIfNotExists(article: Article): Promise<boolean> {
    if (await this.existsByUrl(article.url)) {
      console.log(`文章已存在，跳过保存: ${article.url}`);
      return false;
    }
    await this.save(article);
    return true;
  }

  async save(article: Article): Promise<void> {
    const articles = readJson<Article>(ARTICLES_FILE);
    const index = articles.findIndex(a => a.url === article.url);
    
    // Assign ID if new
    if (!article.id && index === -1) {
      article.id = Date.now(); // Simple ID generation
    }

    if (index >= 0) {
      // Update
      articles[index] = { 
        ...articles[index], 
        ...article, 
        update_date: new Date() 
      };
    } else {
      // Insert
      articles.push({ 
        ...article, 
        created_at: new Date(), 
        crawl_date: article.crawl_date || new Date() 
      });
    }
    
    writeJson(ARTICLES_FILE, articles);
    console.log(`文章已保存到本地: ${article.title}`);
  }

  async saveBatch(articles: Article[]): Promise<number> {
    let count = 0;
    for (const article of articles) {
      // Using saveIfNotExists to handle checks
      const exists = await this.existsByUrl(article.url);
      if (!exists) {
        await this.save(article);
        count++;
      }
    }
    console.log(`批量保存完成，成功保存 ${count} 篇文章`);
    return count;
  }

  async updateSummary(url: string, summary: string): Promise<void> {
    const articles = readJson<Article>(ARTICLES_FILE);
    const index = articles.findIndex(a => a.url === url);
    if (index >= 0) {
      articles[index].summary = summary;
      articles[index].update_date = new Date();
      writeJson(ARTICLES_FILE, articles);
      console.log(`文章摘要已更新: ${url}`);
    }
  }

  async getRecentCrawls(source: string, limit: number = 10): Promise<Article[]> {
    const articles = readJson<Article>(ARTICLES_FILE);
    return articles
      .filter(a => a.source === source)
      .sort((a, b) => new Date(b.crawl_date || 0).getTime() - new Date(a.crawl_date || 0).getTime())
      .slice(0, limit);
  }

  async getStats(source?: string): Promise<any> {
    const articles = readJson<Article>(ARTICLES_FILE);
    // Group by source
    const stats: Record<string, number> = {};
    articles.forEach(a => {
      if (source && a.source !== source) return;
      stats[a.source] = (stats[a.source] || 0) + 1;
    });
    
    return Object.entries(stats).map(([src, count]) => ({ source: src, count }));
  }
}

/**
 * JSON文件爬取日志Repository实现
 */
export class JsonCrawlLogRepository implements ICrawlLogRepository {
  async save(log: CrawlLog): Promise<void> {
    const logs = readJson<CrawlLog>(LOGS_FILE);
    log.created_at = new Date();
    logs.push(log);
    writeJson(LOGS_FILE, logs);
    console.log(`爬取日志已保存到本地: ${log.source} - ${log.status}`);
  }

  async getRecentLogs(source: string, limit: number = 10): Promise<CrawlLog[]> {
    const logs = readJson<CrawlLog>(LOGS_FILE);
    return logs
      .filter(l => l.source === source)
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, limit);
  }
}
