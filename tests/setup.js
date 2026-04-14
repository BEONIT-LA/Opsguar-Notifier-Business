// Fija variables de entorno antes de que cualquier módulo cargue
process.env.JWT_SECRET  = 'test_secret_opsguard';
process.env.NODE_ENV    = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL   = 'redis://localhost:6379';
