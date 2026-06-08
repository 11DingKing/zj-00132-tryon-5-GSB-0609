const prisma = require('../shared/prisma');

async function createAuditLog(userId, action, details) {
  return prisma.auditLog.create({
    data: { userId, action, details },
  });
}

async function getAuditLogs() {
  return prisma.auditLog.findMany({
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

module.exports = {
  createAuditLog,
  getAuditLogs,
};
