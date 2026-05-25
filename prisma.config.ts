// Prisma 7.x config — schema 의 datasource.url 을 대체하는 새 entry point.
// HQ-0004 (`accept-latest-stable`) 채택의 자연스러운 implication (Prisma 7 breaking change).
//
// 본 config 는 `prisma migrate` / `prisma db push` 등 CLI 가 사용하는 connection
// 구성을 박제. runtime (PrismaClient) 의 adapter 구성은 `src/persistence/prisma.service.ts`
// 가 직접 `@prisma/adapter-pg` 를 inject — 본 file 과 분리되어 있어 lifecycle 이 명확.
//
// Prisma CLI 가 자체적으로 `.env` 의 환경변수를 process.env 로 노출 (built-in dotenv).
import type { PrismaConfig } from "prisma";

export default {
  schema: "./prisma/schema.prisma",
  migrations: {
    path: "./prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
} satisfies PrismaConfig;
