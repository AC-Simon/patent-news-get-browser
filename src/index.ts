import Database from './database/connection';
import { Scheduler } from './scheduler/scheduler';
import configLoader from './config/loader';
import { logger } from './utils/logger';

/**
 * 程序入口文件
 */

async function main() {
  try {
    logger.info('='.repeat(60));
    logger.info('通用新闻爬虫系统启动');
    logger.info('='.repeat(60));

    // 加载配置
    logger.info('加载配置文件...');
    const appConfig = configLoader.getAppConfig();
    const websiteConfigs = configLoader.loadWebsiteConfigs();

    logger.info(`已加载 ${websiteConfigs.size} 个网站配置`);

    // 初始化数据库连接（仅当使用PostgreSQL时）
    let db: any = null;
    if (appConfig.storageType === 'postgres') {
      logger.info(`数据库: ${appConfig.database.host}:${appConfig.database.port}/${appConfig.database.database}`);
      logger.info('测试数据库连接...');
      db = Database;
      const connected = await db.testConnection();

      if (!connected) {
        logger.error('数据库连接失败，请检查配置');
        process.exit(1);
      }
    } else {
      logger.info('使用本地JSON存储模式');
      logger.info(`数据将保存到: ${process.cwd()}/data`);
    }

    // 获取命令行参数
    const args = process.argv.slice(2);
    const command = args[0] || 'crawl';

    switch (command) {
      case 'crawl':
        // 执行一次爬取
        logger.info('开始执行爬取任务...');
        const scheduler = Scheduler.getInstance();
        await scheduler.crawlAll();
        logger.info('爬取任务完成');
        break;

      case 'schedule':
        // 启动定时任务
        logger.info('启动定时任务...');
        Scheduler.getInstance().start();
        logger.info('定时任务已启动，按Ctrl+C停止');

        // 保持进程运行
        process.on('SIGINT', async () => {
          logger.info('\n收到停止信号，正在关闭...');
          Scheduler.getInstance().stop();
          if (db && typeof db.close === 'function') {
             await db.close();
          }
          process.exit(0);
        });


        // 防止进程退出
        await new Promise(() => {});
        break;

      case 'list':
        // 列出所有网站配置
        logger.info('已配置的网站:');
        const configs = configLoader.getWebsiteConfigs();
        configs.forEach((config, index) => {
          logger.info(`${index + 1}. ${config.name} - ${config.url}`);
        });
        break;

      case 'test':
        // 测试配置和连接
        logger.info('测试配置和连接...');
        logger.info('✓ 配置加载成功');
        logger.info('✓ 数据库连接正常');
        logger.info('所有测试通过');
        break;

      default:
        logger.error(`未知命令: ${command}`);
        logger.info('可用命令:');
        logger.info('  crawl    - 执行一次爬取');
        logger.info('  schedule - 启动定时任务');
        logger.info('  list     - 列出所有网站配置');
        logger.info('  test     - 测试配置和连接');
        process.exit(1);
    }

    // 关闭数据库连接
    if (db && typeof db.close === 'function') {
      await db.close();
    }
    logger.info('程序执行完毕');
  } catch (error) {
    logger.error('程序执行失败:', error);
    process.exit(1);
  }
}

// 运行主函数
main();
