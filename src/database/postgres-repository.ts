import { Database } from './connection';
import { Article, CrawlLog, IArticleRepository, ICrawlLogRepository } from './interfaces';

/**
 * PostgreSQL文章Repository实现
 */
export class PostgresArticleRepository implements IArticleRepository {
  private db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  async existsByUrl(url: string): Promise<boolean> {
    const result = await this.db.query('SELECT 1 FROM articles WHERE url = $1 LIMIT 1', [url]);
    return (result.rowCount || 0) > 0;
  }

  async findByUrl(url: string): Promise<Article | null> {
    const result = await this.db.query('SELECT * FROM articles WHERE url = $1', [url]);
    if (result.rows.length === 0) {
      return null;
    }
    return this.mapRowToArticle(result.rows[0]);
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
    const query = `
      INSERT INTO articles (title, url, source, content, summary, author, publish_date, crawl_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (url) DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        summary = EXCLUDED.summary,
        author = EXCLUDED.author,
        publish_date = EXCLUDED.publish_date,
        update_date = CURRENT_TIMESTAMP
      RETURNING id
    `;

    const values = [
      article.title,
      article.url,
      article.source,
      article.content || null,
      article.summary || null,
      article.author || null,
      article.publish_date || null,
      article.crawl_date || new Date(),
    ];

    const result = await this.db.query(query, values);
    console.log(`文章已保存，ID: ${result.rows[0].id}, 标题: ${article.title}`);
  }

  async saveBatch(articles: Article[]): Promise<number> {
    let savedCount = 0;

    const client = await this.db.getClient();
    try {
      await client.query('BEGIN');

      for (const article of articles) {
        const exists = await this.existsByUrl(article.url);
        if (!exists) {
          await this.save(article);
          savedCount++;
        }
      }

      await client.query('COMMIT');
      console.log(`批量保存完成，成功保存 ${savedCount} 篇文章`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('批量保存失败:', error);
      throw error;
    } finally {
      client.release();
    }

    return savedCount;
  }

  async updateSummary(url: string, summary: string): Promise<void> {
    const query = 'UPDATE articles SET summary = $1, update_date = CURRENT_TIMESTAMP WHERE url = $2';
    await this.db.query(query, [summary, url]);
    console.log(`文章摘要已更新: ${url}`);
  }

  async getRecentCrawls(source: string, limit: number = 10): Promise<Article[]> {
    const query = `
      SELECT * FROM articles
      WHERE source = $1
      ORDER BY crawl_date DESC
      LIMIT $2
    `;
    const result = await this.db.query(query, [source, limit]);
    return result.rows.map(row => this.mapRowToArticle(row));
  }

  async getStats(source?: string): Promise<any> {
    let query = 'SELECT source, COUNT(*) as count FROM articles';
    let params: any[] = [];

    if (source) {
      query += ' WHERE source = $1 GROUP BY source';
      params.push(source);
    } else {
      query += ' GROUP BY source';
    }

    const result = await this.db.query(query, params);
    return result.rows;
  }

  private mapRowToArticle(row: any): Article {
    return {
      id: row.id,
      title: row.title,
      url: row.url,
      source: row.source,
      content: row.content,
      summary: row.summary,
      author: row.author,
      publish_date: row.publish_date,
      crawl_date: row.crawl_date,
      update_date: row.update_date,
      created_at: row.created_at,
    };
  }
}

/**
 * PostgreSQL爬取日志Repository实现
 */
export class PostgresCrawlLogRepository implements ICrawlLogRepository {
  private db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  async save(log: CrawlLog): Promise<void> {
    const query = `
      INSERT INTO crawl_logs (source, status, articles_found, articles_saved, error_message, start_time, end_time)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    const values = [
      log.source,
      log.status,
      log.articles_found || 0,
      log.articles_saved || 0,
      log.error_message || null,
      log.start_time || null,
      log.end_time || null,
    ];

    await this.db.query(query, values);
    console.log(`爬取日志已保存: ${log.source} - ${log.status}`);
  }

  async getRecentLogs(source: string, limit: number = 10): Promise<CrawlLog[]> {
    const query = `
      SELECT * FROM crawl_logs
      WHERE source = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    const result = await this.db.query(query, [source, limit]);
    return result.rows;
  }
}
