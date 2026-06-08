const prisma = require('../shared/prisma');

async function getAllSkus() {
  return prisma.sKU.findMany();
}

module.exports = {
  getAllSkus,
};
