# 通用新闻爬虫系统 (Patent News Crawler)

一个功能强大、配置驱动的通用新闻爬虫系统，获取汽车相关技术，支持多网站爬取、AI内容摘要、PostgreSQL存储和定时任务。

## 功能特性

- ✅ **配置驱动** - 通过JSON配置文件即可添加新网站，无需修改代码
- ✅ **智能解析** - 支持CSS选择器和Readability算法提取内容
- ✅ **AI摘要** - 集成Qwen Flash API自动生成文章摘要
- ✅ **数据存储** - PostgreSQL存储，自动去重
- ✅ **定时任务** - 灵活的cron表达式配置
- ✅ **日志系统** - 完整的日志记录和错误处理
- ✅ **并发爬取** - 支持多网站并发爬取
- ✅ **反爬虫** - 请求间隔、User-Agent轮换

## 技术栈

- **运行环境**: Node.js + TypeScript
- **爬虫框架**: Playwright
- **数据库**: PostgreSQL
- **AI服务**: Qwen Flash API
- **定时任务**: node-cron
- **日志**: winston

## 安装步骤

### 1. 克隆项目

```bash
git clone https://github.com/AC-Simon/patent-news-get-browser.git
cd patent-news-get-browser
```

### 2. 安装依赖

```bash
npm install
```

### 3. 安装Playwright浏览器

```bash
npx playwright install chromium
```

### 4. 配置环境变量

复制环境变量模板：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填写必要的配置：

```env
# PostgreSQL数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=news_crawler
DB_USER=your_username
DB_PASSWORD=your_password

# Qwen Flash API配置
QWEN_API_KEY=your_qwen_api_key_here
QWEN_API_URL=https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation
QWEN_MODEL=qwen-flash

# 爬虫配置
CRAWL_INTERVAL=2000
REQUEST_TIMEOUT=30000
MAX_RETRIES=3
CONCURRENT_CRAWLERS=3

# 定时任务配置
CRON_SCHEDULE=0 8 * * *
ENABLE_SCHEDULER=false

# 日志配置
LOG_LEVEL=info
LOG_FILE_PATH=logs/crawler.log
```

### 5. 初始化数据库

```bash
npm run init-db
```

## 使用方法

### 命令行操作

#### 执行一次爬取

```bash
npm run crawl
# 或
npm run build && node dist/index.js crawl
```

#### 启动定时任务

```bash
npm run build && node dist/index.js schedule
```

#### 列出已配置的网站

```bash
npm run build && node dist/index.js list
```

#### 测试配置和连接

```bash
npm run build && node dist/index.js test
```

### 开发模式

```bash
npm run dev crawl
npm run dev schedule
```

## 添加新网站

只需在 `config/websites/` 目录下创建一个新的JSON配置文件：

```json
{
  "name": "示例网站",
  "baseUrl": "https://example.com",
  "url": "https://example.com/news",
  "listPage": {
    "articleSelector": ".article-item",
    "titleSelector": "h2 a",
    "linkSelector": "h2 a",
    "dateSelector": ".date",
    "descriptionSelector": ".description"
  },
  "detailPage": {
    "titleSelector": "h1",
    "contentSelector": ".content",
    "authorSelector": ".author",
    "dateSelector": ".publish-time",
    "useReadability": false
  },
  "pagination": {
    "enabled": true,
    "maxPages": 5,
    "urlPattern": "https://example.com/news?page={page}",
    "startPage": 1
  },
  "delay": 2000,
  "enabled": true
}
```

### 配置说明

| 字段                         | 说明                    | 必填 |
| ---------------------------- | ----------------------- | ---- |
| `name`                       | 网站名称                | 是   |
| `baseUrl`                    | 网站基础URL             | 是   |
| `url`                        | 列表页URL               | 是   |
| `listPage.articleSelector`   | 文章列表项选择器        | 是   |
| `listPage.titleSelector`     | 标题选择器              | 否   |
| `listPage.linkSelector`      | 链接选择器              | 是   |
| `listPage.dateSelector`      | 日期选择器              | 否   |
| `detailPage.titleSelector`   | 详情页标题选择器        | 是   |
| `detailPage.contentSelector` | 详情页正文选择器        | 是   |
| `detailPage.useReadability`  | 是否使用Readability提取 | 否   |
| `pagination.enabled`         | 是否启用分页            | 否   |
| `pagination.maxPages`        | 最大页数                | 否   |
| `pagination.urlPattern`      | 分页URL模式             | 否   |
| `delay`                      | 请求延迟（毫秒）        | 否   |
| `enabled`                    | 是否启用该网站          | 否   |

## 数据库结构

### articles 表

| 字段         | 类型          | 说明             |
| ------------ | ------------- | ---------------- |
| id           | SERIAL        | 主键             |
| title        | VARCHAR(1000) | 文章标题         |
| url          | VARCHAR(2000) | 文章链接（唯一） |
| source       | VARCHAR(200)  | 来源网站         |
| content      | TEXT          | 文章正文         |
| summary      | TEXT          | AI生成的摘要     |
| author       | VARCHAR(200)  | 作者             |
| publish_date | TIMESTAMP     | 发布日期         |
| crawl_date   | TIMESTAMP     | 爬取日期         |
| update_date  | TIMESTAMP     | 更新日期         |

### crawl_logs 表

| 字段           | 类型         | 说明       |
| -------------- | ------------ | ---------- |
| id             | SERIAL       | 主键       |
| source         | VARCHAR(200) | 来源网站   |
| status         | VARCHAR(50)  | 状态       |
| articles_found | INTEGER      | 发现文章数 |
| articles_saved | INTEGER      | 保存文章数 |
| error_message  | TEXT         | 错误信息   |
| start_time     | TIMESTAMP    | 开始时间   |
| end_time       | TIMESTAMP    | 结束时间   |

## 项目结构

```
get-browser/
├── config/
│   └── websites/           # 网站配置文件
│       ├── cnautonews.json
│       └── faw.json
├── src/
│   ├── ai/                # AI服务模块
│   │   └── qwen.ts
│   ├── config/            # 配置管理
│   │   ├── types.ts
│   │   └── loader.ts
│   ├── crawler/           # 爬虫引擎
│   │   └── engine.ts
│   ├── database/          # 数据库模块
│   │   ├── connection.ts
│   │   ├── repository.ts
│   │   └── init.ts
│   ├── scheduler/         # 定时任务
│   │   └── scheduler.ts
│   ├── utils/             # 工具函数
│   │   └── logger.ts
│   └── index.ts           # 主入口
├── .env.example           # 环境变量模板
├── package.json
├── tsconfig.json
└── README.md
```

## 注意事项

1. **API限流**: Qwen Flash API有调用频率限制，建议合理设置请求间隔
2. **爬虫礼仪**: 请遵守目标网站的robots.txt规则，设置合理的请求间隔
3. **错误处理**: 爬虫会自动重试失败的请求，但某些错误可能导致跳过文章
4. **数据库性能**: 建议定期清理旧的爬取日志，保持数据库性能

## 常见问题

### 1. Playwright浏览器未安装

```bash
npx playwright install chromium
```

### 2. 数据库连接失败

检查 `.env` 文件中的数据库配置是否正确，确保PostgreSQL服务正在运行。

### 3. API调用失败

检查 `.env` 文件中的 `QWEN_API_KEY` 是否正确配置。

### 4. 配置文件加载失败

确保 `config/websites/` 目录下的JSON文件格式正确，必要字段都已填写。

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！
