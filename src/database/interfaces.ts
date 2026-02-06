export interface Article {
  id?: number;
  title: string;
  url: string;
  source: string;
  content?: string;
  summary?: string;
  author?: string;
  publish_date?: Date;
  crawl_date?: Date;
  update_date?: Date;
  created_at?: Date;
}

export interface CrawlLog {
  id?: number;
  source: string;
  status: string;
  articles_found?: number;
  articles_saved?: number;
  error_message?: string;
  start_time?: Date;
  end_time?: Date;
  created_at?: Date;
}

export interface IArticleRepository {
  existsByUrl(url: string): Promise<boolean>;
  findByUrl(url: string): Promise<Article | null>;
  saveIfNotExists(article: Article): Promise<boolean>;
  save(article: Article): Promise<void>;
  saveBatch(articles: Article[]): Promise<number>;
  updateSummary(url: string, summary: string): Promise<void>;
  getRecentCrawls(source: string, limit?: number): Promise<Article[]>;
  getStats(source?: string): Promise<any>;
}

export interface ICrawlLogRepository {
  save(log: CrawlLog): Promise<void>;
  getRecentLogs(source: string, limit?: number): Promise<CrawlLog[]>;
}
