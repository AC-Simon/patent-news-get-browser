import * as fs from "fs";
import * as path from "path";
import Database from "./connection";
import configLoader from "../config/loader";

/**
 * 初始化数据库
 */
async function initDatabase() {
  const config = configLoader.getAppConfig();
  if (config.storageType === "json") {
    console.log("当前配置为本地JSON存储，无需初始化数据库。");
    return;
  }

  console.log("开始初始化数据库...");

  const db = Database;

  // 测试连接
  const connected = await db.testConnection();
  if (!connected) {
    console.error("数据库连接失败，请检查配置");
    process.exit(1);
  }

  // 读取并执行SQL脚本
  const sqlFile = path.join(__dirname, "init.sql");
  if (!fs.existsSync(sqlFile)) {
    console.error("SQL脚本文件不存在:", sqlFile);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlFile, "utf-8");

  try {
    // 分割SQL语句并逐个执行
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    for (const statement of statements) {
      if (statement.trim()) {
        await db.query(statement);
      }
    }

    console.log("数据库初始化完成！");
  } catch (error) {
    console.error("数据库初始化失败:", error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// 如果直接运行此文件，则执行初始化
if (require.main === module) {
  initDatabase();
}

export default initDatabase;
