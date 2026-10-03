// Заглушка для неподдерживаемых платформ.

module.exports = {
  name: 'unsupported',
  label: 'не поддерживается',
  supported: false,

  async listInterfaces() {
    return { ok: false, error: 'Платформа не поддерживается' };
  },

  async applyRoutes() {
    return [];
  },

  async breakConnections() {
    return { ok: true, broken: [] };
  },

  async getProcessConnections() {
    return [];
  },

  async listProcessNames() {
    return [];
  },

  async isAdmin() {
    return false;
  },

  relaunchAsAdmin() {
    return false;
  },
};
