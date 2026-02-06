import * as cron from "node-cron";
import { CrawlerEngine } from "../crawler/engine";
import { ArticleRepository, CrawlLogRepository } from "../database/repository";
import { AIService } from "../ai/qwen";
import configLoader from "../config/loader";

/**
 * 调度器类
 */
export class Scheduler {
  private static instance: Scheduler;
  private tasks: Map<string, cron.ScheduledTask> = new Map();
  private articleRepo: ArticleRepository;
  private crawlLogRepo: CrawlLogRepository;
  private aiService: AIService;

  private constructor() {
    this.articleRepo = new ArticleRepository();
    this.crawlLogRepo = new CrawlLogRepository();
    this.aiService = new AIService();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): Scheduler {
    if (!Scheduler.instance) {
      Scheduler.instance = new Scheduler();
    }
    return Scheduler.instance;
  }

  /**
   * 爬取单个网站
   */
  private async crawlWebsite(websiteName: string): Promise<void> {
    const config = configLoader.getWebsiteConfig(websiteName);
    if (!config) {
      console.error(`网站配置不存在: ${websiteName}`);
      return;
    }

    const startTime = new Date();
    let articlesFound = 0;
    let articlesSaved = 0;
    let status = "success";
    let errorMessage: string | undefined;

    try {
      console.log(`\n${"=".repeat(50)}`);
      console.log(`开始爬取: ${config.name}`);
      console.log(`时间: ${startTime.toLocaleString("zh-CN")}`);
      console.log(`${"=".repeat(50)}\n`);

      // 创建爬虫引擎并爬取
      const engine = new CrawlerEngine(config);
      const articles = await engine.crawl();
      await engine.close();

      articlesFound = articles.length;

      if (articles.length > 0) {
        // 保存文章到数据库
        for (const article of articles) {
          const saved = await this.articleRepo.saveIfNotExists(article);
          if (saved) {
            articlesSaved++;
          }
        }

        console.log(`\n保存了 ${articlesSaved} 篇新文章`);

        // 为新文章生成AI摘要
        if (articlesSaved > 0) {
          console.log("\n开始生成AI摘要...");
          const summaryMap =
            await this.aiService.generateSummaryBatch(articles);

          // 更新摘要到数据库
          for (const [url, summary] of summaryMap.entries()) {
            await this.articleRepo.updateSummary(url, summary);
          }

          console.log(`AI摘要生成完成: ${summaryMap.size} 篇`);
        }
      } else {
        console.log("没有发现新文章");
      }
    } catch (error: any) {
      status = "failed";
      errorMessage = error.message;
      console.error(`爬取失败: ${websiteName}`, error);
    }

    // 记录日志
    const endTime = new Date();
    await this.crawlLogRepo.save({
      source: websiteName,
      status,
      articles_found: articlesFound,
      articles_saved: articlesSaved,
      error_message: errorMessage,
      start_time: startTime,
      end_time: endTime,
    });

    console.log(`\n${"=".repeat(50)}`);
    console.log(`爬取完成: ${config.name}`);
    console.log(`状态: ${status}`);
    console.log(`发现文章: ${articlesFound} 篇`);
    console.log(`保存文章: ${articlesSaved} 篇`);
    console.log(
      `耗时: ${((endTime.getTime() - startTime.getTime()) / 1000).toFixed(2)} 秒`,
    );
    console.log(`${"=".repeat(50)}\n`);
  }

  /**
   * 爬取所有网站
   */
  public async crawlAll(): Promise<void> {
    const configs = configLoader.getWebsiteConfigs();
    console.log(`开始爬取所有网站，共 ${configs.length} 个`);

    for (const config of configs) {
      await this.crawlWebsite(config.name);
    }

    console.log("所有网站爬取完成");
  }

  /**
   * 启动定时任务
   */
  public start(): void {
    const appConfig = configLoader.getAppConfig();

    if (!appConfig.scheduler.enabled) {
      console.log("定时任务未启用");
      return;
    }

    // 停止已存在的任务
    this.stop();

    // 创建新的定时任务
    const task = cron.schedule(appConfig.scheduler.cronSchedule, async () => {
      console.log("\n定时任务触发，开始爬取...");
      await this.crawlAll();
      console.log("定时任务执行完成\n");
    });

    this.tasks.set("default", task);

    console.log(
      `定时任务已启动，执行计划: ${appConfig.scheduler.cronSchedule}`,
    );
    console.log(
      "定时任务说明: " +
        this.getCronDescription(appConfig.scheduler.cronSchedule),
    );
  }

  /**
   * 停止定时任务
   */
  public stop(): void {
    for (const [name, task] of this.tasks.entries()) {
      task.stop();
      console.log(`定时任务已停止: ${name}`);
    }
    this.tasks.clear();
  }

  /**
   * 获取cron表达式说明
   */
  private getCronDescription(cronExpression: string): string {
    const parts = cronExpression.split(" ");
    if (parts.length !== 5) {
      return "无效的cron表达式";
    }

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    if (
      minute === "0" &&
      hour === "8" &&
      dayOfMonth === "*" &&
      month === "*" &&
      dayOfWeek === "*"
    ) {
      return "每天早上8点执行";
    }

    if (
      minute === "0" &&
      hour === "*/6" &&
      dayOfMonth === "*" &&
      month === "*" &&
      dayOfWeek === "*"
    ) {
      return "每6小时执行一次";
    }

    if (
      minute === "0" &&
      hour === "0" &&
      dayOfMonth === "*" &&
      month === "*" &&
      dayOfWeek === "*"
    ) {
      return "每天凌晨0点执行";
    }

    return "自定义执行计划";
  }

  /**
   * 获取任务状态
   */
  public getStatus(): { running: boolean; taskCount: number } {
    return {
      running: this.tasks.size > 0,
      taskCount: this.tasks.size,
    };
  }
}

export default Scheduler.getInstance();
