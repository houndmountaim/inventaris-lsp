require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const crypto = require('node:crypto');

const SALT = process.env.SALT || 'persediaan-lsp-salt-2026';

const prisma = new PrismaClient({
  log: ['warn', 'error'],
});

function hashPassword(password) {
  return crypto.scryptSync(password, SALT, 64).toString('hex');
}

module.exports = { prisma, hashPassword, SALT };
