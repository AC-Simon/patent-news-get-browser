import { Pool, PoolClient, QueryResult } from "pg";
import { DatabaseConfig } from "../config/types";
import configLoader from "../config/loader";

/**
 * 数据库连接管理类
 */
export class Database {
  private static instance: Database;
  private pool: Pool;

  private constructor(dbConfig: DatabaseConfig) {
    this.pool = new Pool({
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user,
      password: dbConfig.password,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on("error", (err) => {
      console.error("数据库池意外错误:", err);
    });
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): Database {
    if (!Database.instance) {
      const appConfig = configLoader.getAppConfig();
      Database.instance = new Database(appConfig.database);
    }
    return Database.instance;
  }

  /**
   * 执行查询
   */
  public async query(text: string, params?: any[]): Promise<QueryResult> {
    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      console.log("执行查询", { text, duration, rows: res.rowCount });
      return res;
    } catch (error) {
      console.error("查询执行失败:", error);
      throw error;
    }
  }

  /**
   * 获取客户端（用于事务）
   */
  public async getClient(): Promise<PoolClient> {
    const client = await this.pool.connect();
    return client;
  }

  /**
   * 关闭连接池
   */
  public async close(): Promise<void> {
    await this.pool.end();
    console.log("数据库连接池已关闭");
  }

  /**
   * 测试连接
   */
  public async testConnection(): Promise<boolean> {
    try {
      const result = await this.query("SELECT NOW()");
      console.log("数据库连接测试成功:", result.rows[0]);
      return true;
    } catch (error) {
      console.error("数据库连接测试失败:", error);
      return false;
    }
  }
}

export default Database.getInstance();
