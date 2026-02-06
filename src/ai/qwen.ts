import axios, { AxiosInstance } from "axios";
import { Article } from "../database/repository";
import configLoader from "../config/loader";

/**
 * Qwen Flash API响应类型
 */
interface QwenResponse {
  output: {
    text: string;
  };
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

/**
 * AI分析服务类
 */
export class AIService {
  private client: AxiosInstance;
  private apiKey: string;
  private apiUrl: string;
  private model: string;

  constructor() {
    const appConfig = configLoader.getAppConfig();

    this.apiKey = appConfig.qwen.apiKey;
    this.apiUrl = appConfig.qwen.apiUrl;
    this.model = appConfig.qwen.model;

    if (!this.apiKey) {
      console.warn("Qwen API Key未配置，AI摘要功能将被禁用");
    }

    this.client = axios.create({
      timeout: 60000,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
  }

  /**
   * 生成文章摘要
   */
  public async generateSummary(article: Article): Promise<string | null> {
    if (!this.apiKey) {
      console.warn("API Key未配置，跳过AI摘要生成");
      return null;
    }

    if (!article.content) {
      console.warn("文章内容为空，无法生成摘要");
      return null;
    }

    try {
      const prompt = this.buildSummaryPrompt(article);

      const response = await this.client.post(this.apiUrl, {
        model: this.model,
        input: {
          messages: [
            {
              role: "system",
              content:
                "你是一个专业的新闻摘要助手。请根据给定的新闻文章，生成简洁、准确的摘要。摘要应包含文章的核心信息，字数控制在200-300字之间。",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        },
        parameters: {
          max_tokens: 500,
          temperature: 0.7,
        },
      });

      const data: QwenResponse = response.data;
      const summary = data.output.text.trim();

      console.log(`AI摘要生成成功: ${article.title}`);
      console.log(`使用tokens: ${data.usage.total_tokens}`);

      return summary;
    } catch (error: any) {
      console.error("AI摘要生成失败:", error.response?.data || error.message);

      // 如果是429错误（限流），等待后重试
      if (error.response?.status === 429) {
        console.warn("API限流，等待10秒后重试...");
        await this.sleep(10000);
        return this.generateSummary(article);
      }

      return null;
    }
  }

  /**
   * 批量生成摘要
   */
  public async generateSummaryBatch(
    articles: Article[],
  ): Promise<Map<string, string>> {
    const summaryMap = new Map<string, string>();

    for (const article of articles) {
      if (!article.url) {
        continue;
      }

      const summary = await this.generateSummary(article);
      if (summary) {
        summaryMap.set(article.url, summary);
      }

      // API调用间隔，避免触发限流
      await this.sleep(1000);
    }

    return summaryMap;
  }

  /**
   * 构建摘要提示词
   */
  private buildSummaryPrompt(article: Article): string {
    let prompt = `文章标题：${article.title}\n\n`;

    if (article.author) {
      prompt += `作者：${article.author}\n\n`;
    }

    if (article.publish_date) {
      prompt += `发布时间：${article.publish_date.toLocaleString("zh-CN")}\n\n`;
    }

    // 截取正文前3000字符（避免超过token限制）
    const content = article.content || "";
    const truncatedContent =
      content.length > 3000 ? content.substring(0, 3000) + "..." : content;

    prompt += `文章内容：\n${truncatedContent}\n\n`;
    prompt += "请为这篇文章生成200-300字的摘要：";

    return prompt;
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 测试API连接
   */
  public async testConnection(): Promise<boolean> {
    if (!this.apiKey) {
      console.warn("API Key未配置");
      return false;
    }

    try {
      const response = await this.client.post(this.apiUrl, {
        model: this.model,
        input: {
          messages: [
            {
              role: "user",
              content: "测试连接",
            },
          ],
        },
        parameters: {
          max_tokens: 10,
        },
      });

      console.log("Qwen API连接测试成功");
      return true;
    } catch (error) {
      console.error("Qwen API连接测试失败:", error);
      return false;
    }
  }
}

export default AIService;
