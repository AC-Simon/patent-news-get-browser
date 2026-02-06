-- 创建数据库（如果不存在）
-- CREATE DATABASE IF NOT EXISTS news_crawler;

-- 使用数据库
-- \c news_crawler

-- 文章表
CREATE TABLE IF NOT EXISTS articles (
    id SERIAL PRIMARY KEY,
    title VARCHAR(1000) NOT NULL,
    url VARCHAR(2000) UNIQUE NOT NULL,
    source VARCHAR(200) NOT NULL,
    content TEXT,
    summary TEXT,
    author VARCHAR(200),
    publish_date TIMESTAMP,
    crawl_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT url_unique UNIQUE (url)
);

-- 爬取日志表
CREATE TABLE IF NOT EXISTS crawl_logs (
    id SERIAL PRIMARY KEY,
    source VARCHAR(200) NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'success', 'failed', 'partial'
    articles_found INTEGER DEFAULT 0,
    articles_saved INTEGER DEFAULT 0,
    error_message TEXT,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source);
CREATE INDEX IF NOT EXISTS idx_articles_publish_date ON articles(publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_articles_crawl_date ON articles(crawl_date DESC);
CREATE INDEX IF NOT EXISTS idx_articles_url ON articles(url);
CREATE INDEX IF NOT EXISTS idx_crawl_logs_source ON crawl_logs(source);
CREATE INDEX IF NOT EXISTS idx_crawl_logs_created_at ON crawl_logs(created_at DESC);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_update_date()
RETURNS TRIGGER AS $$
BEGIN
    NEW.update_date = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_articles_update_date
    BEFORE UPDATE ON articles
    FOR EACH ROW
    EXECUTE FUNCTION update_update_date();

-- 添加注释
COMMENT ON TABLE articles IS '文章表，存储爬取的新闻文章';
COMMENT ON TABLE crawl_logs IS '爬取日志表，记录每次爬取的执行情况';
COMMENT ON COLUMN articles.summary IS 'AI生成的文章摘要';
COMMENT ON COLUMN articles.source IS '文章来源网站';
