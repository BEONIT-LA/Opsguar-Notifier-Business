require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
};

module.exports = config;
