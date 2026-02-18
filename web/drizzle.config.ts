import { config } from "dotenv";
config({ path: ".env.development.local" });
config({ path: ".env.local" });
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // 优先直连（绕过连接池），Neon 生产环境需要；本地 Docker 两者相同
    url: (process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL)!,
  },
});
