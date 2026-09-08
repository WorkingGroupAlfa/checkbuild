import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { failed: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('The property viewer could not render.', error, info);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="site-shell error-page">
          <div className="masthead"><span className="wordmark"><span>470</span><small>Collins<br />Street</small></span></div>
          <p className="eyebrow">Available spaces</p>
          <h1>The building view is temporarily unavailable.</h1>
          <p>Please refresh the page to try again. No information has been submitted.</p>
          <button className="button primary" type="button" onClick={() => window.location.reload()}>Refresh viewer</button>
        </main>
      );
    }
    return this.props.children;
  }
}
