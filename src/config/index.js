require('dotenv').config();

const config = {
  port:  process.env.PORT       || 3000,
  env:   process.env.NODE_ENV   || 'development',
  redis: {
    url: process.env.REDIS_URL  || 'redis://localhost:6379',
  },
  auth: {
    jwtSecret:  process.env.JWT_SECRET  || 'opsguard_dev_secret',
    jwtExpires: process.env.JWT_EXPIRES || '8h',
    adminUser:  process.env.ADMIN_USER  || 'admin',
    adminPass:  process.env.ADMIN_PASS  || 'admin123',
  },
};

module.exports = config;
