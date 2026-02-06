import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { AppConfig, WebsiteConfig } from "./types";

// 加载环境变量
dotenv.config();

/**
 * 配置加载器类
 */
export class ConfigLoader {
  private static instance: ConfigLoader;
  private appConfig: AppConfig;
  private websiteConfigs: Map<string, WebsiteConfig> = new Map();

  private constructor() {
    this.appConfig = this.loadAppConfig();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  /**
   * 加载应用配置
   */
  private loadAppConfig(): AppConfig {
    return {
      storageType:
        (process.env.STORAGE_TYPE as "postgres" | "json") || "postgres",
      database: {
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT || "5432"),
        database: process.env.DB_NAME || "news_crawler",
        user: process.env.DB_USER || "postgres",
        password: process.env.DB_PASSWORD || "",
      },
      qwen: {
        apiKey: process.env.QWEN_API_KEY || "",
        apiUrl:
          process.env.QWEN_API_URL ||
          "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
        model: process.env.QWEN_MODEL || "qwen-flash",
      },
      crawler: {
        interval: parseInt(process.env.CRAWL_INTERVAL || "2000"),
        timeout: parseInt(process.env.REQUEST_TIMEOUT || "30000"),
        maxRetries: parseInt(process.env.MAX_RETRIES || "3"),
        concurrent: parseInt(process.env.CONCURRENT_CRAWLERS || "3"),
      },
      log: {
        level: process.env.LOG_LEVEL || "info",
        filePath: process.env.LOG_FILE_PATH || "logs/crawler.log",
      },
      scheduler: {
        enabled: process.env.ENABLE_SCHEDULER === "true",
        cronSchedule: process.env.CRON_SCHEDULE || "0 8 * * *",
      },
      playwright: {
        headless: process.env.HEADLESS !== "false",
        viewportWidth: parseInt(process.env.BROWSER_VIEWPORT_WIDTH || "1920"),
        viewportHeight: parseInt(process.env.BROWSER_VIEWPORT_HEIGHT || "1080"),
      },
    };
  }

  /**
   * 获取应用配置
   */
  public getAppConfig(): AppConfig {
    return this.appConfig;
  }

  /**
   * 加载所有网站配置文件
   */
  public loadWebsiteConfigs(): Map<string, WebsiteConfig> {
    const configDir = path.join(process.cwd(), "config", "websites");

    if (!fs.existsSync(configDir)) {
      console.warn(`网站配置目录不存在: ${configDir}`);
      return this.websiteConfigs;
    }

    const files = fs
      .readdirSync(configDir)
      .filter((file) => file.endsWith(".json"));

    for (const file of files) {
      try {
        const filePath = path.join(configDir, file);
        const content = fs.readFileSync(filePath, "utf-8");
        const config: WebsiteConfig = JSON.parse(content);

        // 验证必要字段
        if (
          !config.name ||
          !config.url ||
          !config.listPage ||
          !config.detailPage
        ) {
          console.error(`配置文件 ${file} 缺少必要字段，跳过加载`);
          continue;
        }

        // 默认启用
        if (config.enabled === undefined) {
          config.enabled = true;
        }

        // 默认分页配置
        if (!config.pagination) {
          config.pagination = { enabled: false };
        }

        // 默认延迟
        if (!config.delay) {
          config.delay = this.appConfig.crawler.interval;
        }

        this.websiteConfigs.set(config.name, config);
        console.log(`成功加载网站配置: ${config.name}`);
      } catch (error) {
        console.error(`加载配置文件 ${file} 失败:`, error);
      }
    }

    return this.websiteConfigs;
  }

  /**
   * 获取所有网站配置
   */
  public getWebsiteConfigs(): WebsiteConfig[] {
    if (this.websiteConfigs.size === 0) {
      this.loadWebsiteConfigs();
    }
    return Array.from(this.websiteConfigs.values()).filter(
      (config) => config.enabled !== false,
    );
  }

  /**
   * 根据名称获取网站配置
   */
  public getWebsiteConfig(name: string): WebsiteConfig | undefined {
    if (this.websiteConfigs.size === 0) {
      this.loadWebsiteConfigs();
    }
    return this.websiteConfigs.get(name);
  }

  /**
   * 添加网站配置
   */
  public addWebsiteConfig(config: WebsiteConfig): void {
    this.websiteConfigs.set(config.name, config);
  }
}

// 导出单例实例
export default ConfigLoader.getInstance();
