const { PrismaClient } = require('@prisma/client');

// Prisma singleton — prevents exhausting DB connections in dev
// (Next.js hot reload / nodemon would otherwise create a new client each time)
const globalForPrisma = globalThis;

const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

module.exports = prisma;
