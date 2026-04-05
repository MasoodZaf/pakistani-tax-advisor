const { PrismaClient } = require('@prisma/client');

// Singleton — reuse one client across the whole process
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = prisma;
