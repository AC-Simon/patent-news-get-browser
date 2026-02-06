import { chromium, Browser, Page, BrowserContext } from "playwright";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { WebsiteConfig } from "../config/types";
import { Article } from "../database/repository";
import configLoader from "../config/loader";

/**
 * 列表页文章信息
 */
interface ListArticle {
  title: string;
  url: string;
  date?: string;
  description?: string;
}

/**
 * 爬虫引擎类
 */
export class CrawlerEngine {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private config: WebsiteConfig;

  constructor(config: WebsiteConfig) {
    this.config = config;
  }

  /**
   * 初始化浏览器
   */
  private async initBrowser(): Promise<void> {
    if (this.browser) {
      return;
    }

    const playwrightConfig = configLoader.getAppConfig().playwright;

    this.browser = await chromium.launch({
      headless: playwrightConfig.headless,
    });

    this.context = await this.browser.newContext({
      viewport: {
        width: playwrightConfig.viewportWidth,
        height: playwrightConfig.viewportHeight,
      },
      userAgent:
        this.config.userAgent ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    });

    console.log(`浏览器已启动: ${this.config.name}`);
  }

  /**
   * 关闭浏览器
   */
  public async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
    this.browser = null;
    this.context = null;
    console.log(`浏览器已关闭: ${this.config.name}`);
  }

  /**
   * 延迟函数
   */
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 解析日期字符串
   */
  private parseDate(dateStr: string): Date | undefined {
    if (!dateStr) return undefined;

    // 清理常见的干扰字符
    const cleaned = dateStr
      .replace(/发布(时间|日期)[：:]/g, "") // 移除前缀
      .replace(/[·\s]+$/, "") // 移除末尾的·和空格
      .trim();

    // 尝试提取标准日期格式 YYYY-MM-DD
    const match = cleaned.match(/(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})[日]?/);
    if (match) {
      return new Date(`${match[1]}-${match[2]}-${match[3]}`);
    }

    // 尝试直接解析
    const date = new Date(cleaned);
    if (!isNaN(date.getTime())) {
      return date;
    }

    return undefined;
  }

  /**
   * 抓取列表页
   */
  public async crawlListPage(pageUrl: string): Promise<ListArticle[]> {
    await this.initBrowser();
    if (!this.context) {
      throw new Error("浏览器上下文未初始化");
    }

    const page = await this.context.newPage();
    const articles: ListArticle[] = [];

    try {
      console.log(`正在访问列表页: ${pageUrl}`);
      // 使用 domcontentloaded 以避免网络请求（如广告）导致的超时
      await page.goto(pageUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      // 等待列表加载
      await this.delay(2000);

      // 提取文章列表
      const articleElements = await page.$$(
        this.config.listPage.articleSelector,
      );
      console.log(`找到 ${articleElements.length} 篇文章`);

      for (const element of articleElements) {
        try {
          const article: ListArticle = {
            title: "",
            url: "",
          };

          // 提取标题
          if (this.config.listPage.titleSelector) {
            article.title = await element.$eval(
              this.config.listPage.titleSelector,
              (el) => el.textContent?.trim() || "",
            );
          } else {
            article.title = await element.evaluate(
              (el) => el.textContent?.trim() || "",
            );
          }

          // 提取链接
          const linkEl = await element.$(this.config.listPage.linkSelector);
          if (linkEl) {
            const href = await linkEl.getAttribute("href");
            if (href) {
              // 处理相对路径
              article.url = href.startsWith("http")
                ? href
                : new URL(href, this.config.baseUrl).href;
            }
          }

          // 提取日期
          if (this.config.listPage.dateSelector) {
            try {
              article.date = await element.$eval(
                this.config.listPage.dateSelector,
                (el) => el.textContent?.trim() || "",
              );
            } catch (e) {
              // 日期字段可选，忽略错误
            }
          }

          // 提取描述
          if (this.config.listPage.descriptionSelector) {
            try {
              article.description = await element.$eval(
                this.config.listPage.descriptionSelector,
                (el) => el.textContent?.trim() || "",
              );
            } catch (e) {
              // 描述字段可选，忽略错误
            }
          }

          if (article.title && article.url) {
            articles.push(article);
          }
        } catch (e) {
          console.error("提取文章信息失败:", e);
        }
      }

      console.log(`成功提取 ${articles.length} 篇文章信息`);
    } catch (error) {
      console.error(`抓取列表页失败: ${pageUrl}`, error);
    } finally {
      await page.close();
    }

    return articles;
  }

  /**
   * 抓取文章详情页
   */
  public async crawlDetailPage(
    articleUrl: string,
    listArticle?: ListArticle,
  ): Promise<Article | null> {
    await this.initBrowser();
    if (!this.context) {
      throw new Error("浏览器上下文未初始化");
    }

    const page = await this.context.newPage();

    try {
      console.log(`正在抓取文章详情: ${articleUrl}`); // 访问文章详情页
      // 使用 domcontentloaded 以避免长时间等待
      await page.goto(articleUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      // 等待内容加载
      await this.delay(1000);

      // 等待页面加载
      await this.delay(this.config.delay || 2000);

      const article: Article = {
        title: "",
        url: articleUrl,
        source: this.config.name,
        crawl_date: new Date(),
      };

      // 提取标题
      try {
        const titleEl = await page.$(this.config.detailPage.titleSelector);
        if (titleEl) {
          article.title = await titleEl.evaluate(
            (el) => el.textContent?.trim() || "",
          );
        }
      } catch (e) {
        console.warn("提取标题失败，使用列表页标题");
        article.title = listArticle?.title || "";
      }

      // 提取正文
      if (this.config.detailPage.useReadability) {
        // 使用Readability提取正文
        const html = await page.content();
        const dom = new JSDOM(html, { url: articleUrl });
        const parsed = new Readability(dom.window.document).parse();
        article.content = parsed?.textContent || "";
      } else {
        // 使用选择器提取正文
        try {
          const contentEl = await page.$(
            this.config.detailPage.contentSelector,
          );
          if (contentEl) {
            article.content = await contentEl.evaluate(
              (el) => el.textContent?.trim() || "",
            );
          }
        } catch (e) {
          console.error("提取正文失败:", e);
        }
      }

      // 提取作者
      if (this.config.detailPage.authorSelector) {
        try {
          const authorEl = await page.$(this.config.detailPage.authorSelector);
          if (authorEl) {
            article.author = await authorEl.evaluate(
              (el) => el.textContent?.trim() || "",
            );
          }
        } catch (e) {
          // 作者字段可选，忽略错误
        }
      }

      // 提取发布日期
      if (this.config.detailPage.dateSelector) {
        try {
          const dateEl = await page.$(this.config.detailPage.dateSelector);
          if (dateEl) {
            const dateText = await dateEl.evaluate(
              (el) => el.textContent?.trim() || "",
            );
            const parsedDate = this.parseDate(dateText);
            if (parsedDate) {
              article.publish_date = parsedDate;
            }
          }
        } catch (e) {
          // 如果详情页提取失败，将在下面尝试使用列表页的日期
        }
      }

      // 如果详情页没有提取到日期，尝试使用列表页的日期
      if (!article.publish_date && listArticle?.date) {
        const parsedDate = this.parseDate(listArticle.date);
        if (parsedDate) {
          article.publish_date = parsedDate;
        }
      }

      console.log(`文章详情抓取成功: ${article.title}`);
      return article;
    } catch (error) {
      console.error(`抓取文章详情失败: ${articleUrl}`, error);
      return null;
    } finally {
      await page.close();
    }
  }

  /**
   * 获取所有分页URL
   */
  private getPageUrls(): string[] {
    const urls: string[] = [];
    const pagination = this.config.pagination;

    if (!pagination || !pagination.enabled) {
      return [this.config.url];
    }

    if (pagination.urlPattern) {
      // 使用URL模式生成分页URL
      const maxPages = pagination.maxPages || 1;
      const startPage = pagination.startPage || 1;

      for (let i = startPage; i <= maxPages; i++) {
        const url = pagination.urlPattern.replace("{page}", i.toString());
        urls.push(url);
      }
    } else {
      // 只返回初始URL，后续通过"下一页"按钮导航
      urls.push(this.config.url);
    }

    return urls;
  }

  /**
   * 执行完整的爬取流程
   */
  public async crawl(): Promise<Article[]> {
    console.log(`\n========== 开始爬取: ${this.config.name} ==========`);
    if (this.config.maxArticles) {
      console.log(`最大爬取数量限制: ${this.config.maxArticles} 篇`);
    }

    const allArticles: Article[] = [];
    const pageUrls = this.getPageUrls();

    for (const pageUrl of pageUrls) {
      // 检查是否达到最大数量限制
      if (
        this.config.maxArticles &&
        allArticles.length >= this.config.maxArticles
      ) {
        console.log(
          `达到最大爬取数量限制 (${this.config.maxArticles} 篇)，停止爬取`,
        );
        break;
      }

      console.log(`\n--- 爬取列表页: ${pageUrl} ---`);

      // 抓取列表页
      const listArticles = await this.crawlListPage(pageUrl);
      console.log(`发现 ${listArticles.length} 篇文章`);

      // 抓取每篇文章的详情
      for (const listArticle of listArticles) {
        // 再次检查是否达到最大数量限制
        if (
          this.config.maxArticles &&
          allArticles.length >= this.config.maxArticles
        ) {
          console.log(
            `达到最大爬取数量限制 (${this.config.maxArticles} 篇)，停止爬取`,
          );
          break;
        }

        const article = await this.crawlDetailPage(
          listArticle.url,
          listArticle,
        );
        if (article && article.title && article.content) {
          allArticles.push(article);
        }

        // 请求间隔
        await this.delay(this.config.delay || 2000);
      }
    }

    console.log(
      `\n========== 爬取完成: ${this.config.name}, 共 ${allArticles.length} 篇文章 ==========\n`,
    );

    return allArticles;
  }
}

export default CrawlerEngine;
