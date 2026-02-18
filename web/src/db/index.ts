import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { _pgClient?: postgres.Sql };

function getClient() {
  if (!globalForDb._pgClient) {
    globalForDb._pgClient = postgres(process.env.DATABASE_URL!);
  }
  return globalForDb._pgClient;
}

export const db = drizzle({ client: getClient(), schema });
