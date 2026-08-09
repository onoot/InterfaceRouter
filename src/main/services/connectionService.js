const platform = require('../platform');

// Сервис живого списка TCP-соединений (вкладка «Соединения»).
// Периодически опрашивает систему через platform.listConnections и
// публикует обновлённый список в состояние — diff/«убитые» соединения
// уже обрабатываются в renderer (серые на 1.5 c).

const POLL_MS = 2000;

class ConnectionService {
  constructor(ctx) {
    this.ctx = ctx; // { state, log }
    this.timer = null;
    this.lastJson = '';
  }

  get state() { return this.ctx.state; }
  get log() { return this.ctx.log; }

  start() {
    this.stop();
    this.timer = setInterval(() => this.tick(), POLL_MS);
    this.tick();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick() {
    try {
      const list = await platform.listConnections((e) => this.log.command(e));
      const next = JSON.stringify(list);
      if (next !== this.lastJson) {
        this.lastJson = next;
        this.state.setConnections(list);
      }
    } catch (e) {
      this.log.error(`Ошибка опроса соединений: ${e.message}`);
    }
  }
}

module.exports = ConnectionService;
