// Каналы IPC — единая точка контракта между preload / main / renderer.
// «Ручки» (имена каналов) отделены от их реализаций (см. src/main/ipc.js).
const IPC = {
  // Вызовы (request/response)
  AppGetState: 'app:getState',
  AppRelaunchAsAdmin: 'app:relaunchAsAdmin',
  AppIsAdmin: 'app:isAdmin',
  AppOpenLogsFolder: 'app:openLogsFolder',
  AppPickExecutable: 'app:pickExecutable',

  InterfacesList: 'interfaces:list',
  InterfacesRefresh: 'interfaces:refresh',
  InterfaceCheckIp: 'interface:checkIp',

  RulesList: 'rules:list',
  RulesCreate: 'rules:create',
  RulesUpdate: 'rules:update',
  RulesDelete: 'rules:delete',
  RulesToggle: 'rules:toggle',
  RulesCheckIp: 'rules:checkIp',
  RulesCheckAllIp: 'rules:checkAllIp',
  RulesReconcile: 'rules:reconcile',
  ProcessesSuggest: 'processes:suggest',

  SettingsGet: 'settings:get',
  SettingsUpdate: 'settings:update',

  LogsGet: 'logs:get',
  LogsClear: 'logs:clear',

  // Публикации (push events в renderer)
  LogsAppend: 'logs:append',
  StateChanged: 'state:changed',
  RulesChanged: 'rules:changed',
  InterfacesChanged: 'interfaces:changed',
};

module.exports = IPC;
