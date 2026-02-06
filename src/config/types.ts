/**
 * 网站配置类型定义
 */

// 列表页配置
export interface ListPageConfig {
  // 文章列表项的选择器
  articleSelector: string;
  // 标题选择器
  titleSelector?: string;
  // 链接选择器
  linkSelector: string;
  // 日期选择器
  dateSelector?: string;
  // 描述选择器
  descriptionSelector?: string;
}

// 详情页配置
export interface DetailPageConfig {
  // 标题选择器
  titleSelector: string;
  // 正文内容选择器
  contentSelector: string;
  // 作者选择器
  authorSelector?: string;
  // 发布日期选择器
  dateSelector?: string;
  // 是否使用Readability提取正文
  useReadability?: boolean;
}

// 分页配置
export interface PaginationConfig {
  // 是否有分页
  enabled: boolean;
  // 最大页数（0表示不限制）
  maxPages?: number;
  // 下一页按钮选择器
  nextSelector?: string;
  // URL分页模式，例如：/list?page={page}
  urlPattern?: string;
  // 起始页码
  startPage?: number;
}

// 网站配置
export interface WebsiteConfig {
  // 网站名称
  name: string;
  // 网站基础URL
  baseUrl: string;
  // 初始URL（列表页）
  url: string;
  // 列表页配置
  listPage: ListPageConfig;
  // 详情页配置
  detailPage: DetailPageConfig;
  // 分页配置
  pagination?: PaginationConfig;
  // 请求延迟（毫秒）
  delay?: number;
  // User-Agent
  userAgent?: string;
  // 最大爬取文章数量
  maxArticles?: number;
  // 是否启用
  enabled?: boolean;
}

// 数据库配置
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

// Qwen API配置
export interface QwenConfig {
  apiKey: string;
  apiUrl: string;
  model: string;
}

// 爬虫配置
export interface CrawlerConfig {
  interval: number;
  timeout: number;
  maxRetries: number;
  concurrent: number;
}

// 日志配置
export interface LogConfig {
  level: string;
  filePath: string;
}

// 调度器配置
export interface SchedulerConfig {
  enabled: boolean;
  cronSchedule: string;
}

// Playwright配置
export interface PlaywrightConfig {
  headless: boolean;
  viewportWidth: number;
  viewportHeight: number;
}

// 完整的应用配置
export interface AppConfig {
  storageType: "postgres" | "json";
  database: DatabaseConfig;
  qwen: QwenConfig;
  crawler: CrawlerConfig;
  log: LogConfig;
  scheduler: SchedulerConfig;
  playwright: PlaywrightConfig;
}
