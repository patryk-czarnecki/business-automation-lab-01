import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env.DATABASE_URL || undefined,
    // Optional, separate disposable database for migrate dev only.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL || undefined,
  },
});
