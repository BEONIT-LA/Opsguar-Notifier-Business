// Mock automático de la base de datos para tests
// jest.mock('../src/config/database') usa este archivo
const db = {
  query: jest.fn(),
};
module.exports = db;
