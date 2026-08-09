import React from 'react';
import { ErrorScreen } from './ErrorScreen.jsx';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[error-boundary]', error?.message, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorScreen
          title="Критическая ошибка интерфейса"
          message={String(this.state.error?.message || this.state.error)}
          detail={this.state.error?.stack}
        />
      );
    }
    return this.props.children;
  }
}
