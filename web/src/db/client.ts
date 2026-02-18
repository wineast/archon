/**
 * CLI 脚本（seed / migrate / reset）共享的 postgres.js 客户端工厂。
 * 按 Next.js 优先级加载环境变量，优先使用 DATABASE_URL_UNPOOLED。
 */
import { config } from "dotenv";
config({ path: ".env.development.local" });
config({ path: ".env.local" });

import postgres from "postgres";

export function createClient() {
  // 优先直连（绕过连接池），Neon 生产环境需要；本地 Docker 两者相同
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return postgres(url);
}
