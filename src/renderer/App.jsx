import React from 'react';
import { useApp } from './store.js';
import { Sidebar } from './components/Sidebar.jsx';
import { StatusBar } from './components/StatusBar.jsx';
import { RulesPage } from './components/RulesPage.jsx';
import { InterfacesPage } from './components/InterfacesPage.jsx';
import { ConnectionsPage } from './components/ConnectionsPage.jsx';
import { TerminalPage } from './components/TerminalPage.jsx';
import { SettingsPage } from './components/SettingsPage.jsx';
import { Toaster } from './components/Toaster.jsx';
import { ErrorScreen } from './components/ErrorScreen.jsx';

export default function App() {
  const { tab, initError } = useApp();

  if (initError) {
    return (
      <>
        <ErrorScreen title="Ошибка запуска" message={initError} />
        <Toaster />
      </>
    );
  }

  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        {tab === 'rules' ? <RulesPage /> : null}
        {tab === 'interfaces' ? <InterfacesPage /> : null}
        {tab === 'connections' ? <ConnectionsPage /> : null}
        {tab === 'terminal' ? <TerminalPage /> : null}
        {tab === 'settings' ? <SettingsPage /> : null}
        <StatusBar />
      </div>
      <Toaster />
    </div>
  );
}
