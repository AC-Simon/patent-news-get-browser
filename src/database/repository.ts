import configLoader from "../config/loader";
import {
  IArticleRepository,
  ICrawlLogRepository,
  Article,
  CrawlLog,
} from "./interfaces";
import {
  PostgresArticleRepository,
  PostgresCrawlLogRepository,
} from "./postgres-repository";
import {
  JsonArticleRepository,
  JsonCrawlLogRepository,
} from "./json-repository";

// Re-export interfaces
export { Article, CrawlLog, IArticleRepository, ICrawlLogRepository };

/**
 * Repository工厂类
 */
export class RepositoryFactory {
  static getArticleRepository(): IArticleRepository {
    const config = configLoader.getAppConfig();
    if (config.storageType === "json") {
      return new JsonArticleRepository();
    }
    return new PostgresArticleRepository();
  }

  static getCrawlLogRepository(): ICrawlLogRepository {
    const config = configLoader.getAppConfig();
    if (config.storageType === "json") {
      return new JsonCrawlLogRepository();
    }
    return new PostgresCrawlLogRepository();
  }
}

/**
 * 文章Repository代理类
 * 自动根据配置选择PostgreSQL或JSON存储
 */
export class ArticleRepository implements IArticleRepository {
  private repo: IArticleRepository;

  constructor() {
    this.repo = RepositoryFactory.getArticleRepository();
  }

  existsByUrl(url: string): Promise<boolean> {
    return this.repo.existsByUrl(url);
  }

  findByUrl(url: string): Promise<Article | null> {
    return this.repo.findByUrl(url);
  }

  saveIfNotExists(article: Article): Promise<boolean> {
    return this.repo.saveIfNotExists(article);
  }

  save(article: Article): Promise<void> {
    return this.repo.save(article);
  }

  saveBatch(articles: Article[]): Promise<number> {
    return this.repo.saveBatch(articles);
  }

  updateSummary(url: string, summary: string): Promise<void> {
    return this.repo.updateSummary(url, summary);
  }

  getRecentCrawls(source: string, limit: number = 10): Promise<Article[]> {
    return this.repo.getRecentCrawls(source, limit);
  }

  getStats(source?: string): Promise<any> {
    return this.repo.getStats(source);
  }
}

/**
 * 爬取日志Repository代理类
 */
export class CrawlLogRepository implements ICrawlLogRepository {
  private repo: ICrawlLogRepository;

  constructor() {
    this.repo = RepositoryFactory.getCrawlLogRepository();
  }

  save(log: CrawlLog): Promise<void> {
    return this.repo.save(log);
  }

  getRecentLogs(source: string, limit: number = 10): Promise<CrawlLog[]> {
    return this.repo.getRecentLogs(source, limit);
  }
}

export default ArticleRepository;
