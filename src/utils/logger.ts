import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';
import configLoader from '../config/loader';

/**
 * 日志工具类
 */
export class Logger {
  private static instance: winston.Logger;

  /**
   * 获取日志实例
   */
  public static getInstance(): winston.Logger {
    if (!Logger.instance) {
      const appConfig = configLoader.getAppConfig();
      const logFilePath = appConfig.log.filePath;
      const logLevel = appConfig.log.level;

      // 确保日志目录存在
      const logDir = path.dirname(logFilePath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      // 创建日志格式
      const logFormat = winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.printf(({ level, message, timestamp, ...metadata }) => {
          let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;

          // 添加元数据
          if (Object.keys(metadata).length > 0) {
            msg += ` ${JSON.stringify(metadata)}`;
          }

          return msg;
        })
      );

      // 创建logger
      Logger.instance = winston.createLogger({
        level: logLevel,
        format: logFormat,
        transports: [
          // 控制台输出
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              logFormat
            ),
          }),
          // 文件输出
          new winston.transports.File({
            filename: logFilePath,
            maxsize: 10485760, // 10MB
            maxFiles: 5,
          }),
          // 错误日志单独文件
          new winston.transports.File({
            filename: logFilePath.replace('.log', '.error.log'),
            level: 'error',
            maxsize: 10485760,
            maxFiles: 5,
          }),
        ],
      });

      console.log(`日志系统已初始化，级别: ${logLevel}`);
    }

    return Logger.instance;
  }
}

// 导出便捷方法
export const logger = Logger.getInstance();

export default logger;
