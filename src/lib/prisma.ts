import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — copy .env.example to .env and fill it in.");
  }
  // Prisma 7 requires a driver adapter; there's no built-in engine connection any more.
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const prisma = globalForPrisma.prisma ?? createClient();

// Without this, every hot reload in dev opens a fresh pool and Postgres runs out of slots.
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
