/**
 * Prisma Client Singleton
 * CODE-FIRST data access layer for RFP system
 * 
 * This replaces all direct Supabase Client calls with type-safe Prisma queries.
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Export Prisma enums for type safety
export {
  ResetJobStatus,
  PermissionAction,
  PermissionResult,
  PrincipalType
} from '@prisma/client';

// Helper to get type-safe Prisma client
export function getPrismaClient(): PrismaClient {
  return prisma;
}
