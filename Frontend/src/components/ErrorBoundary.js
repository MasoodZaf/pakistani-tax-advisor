import React from 'react';

/**
 * Top-level error boundary (FE-01). Without one, any render-time throw in a
 * route unmounts the whole tree to a blank white screen with no recovery path.
 * This catches the error, logs it (to the console, and to window.Sentry if a
 * host page ever wires one up), and shows a branded recovery card instead.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Uncaught render error:', error, info?.componentStack);
    if (typeof window !== 'undefined' && window.Sentry?.captureException) {
      window.Sentry.captureException(error, { extra: { componentStack: info?.componentStack } });
    }
  }

  handleReload = () => {
    // Full reload clears the broken render tree and re-fetches a fresh bundle.
    window.location.assign('/');
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: 'var(--brand-cream, #FBF8F1)',
          color: 'var(--brand-on-cream-navy, #28396C)',
          fontFamily: "'Nunito', system-ui, sans-serif",
        }}
      >
        <h1 style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>
          Something went wrong
        </h1>
        <p style={{ maxWidth: '28rem', margin: 0, color: 'var(--content-muted, #475569)' }}>
          The page hit an unexpected error. Your saved tax data is safe — reloading usually fixes it.
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          style={{
            marginTop: '0.5rem',
            backgroundColor: 'var(--brand-navy, #28396C)',
            color: '#fff',
            border: 'none',
            borderRadius: '0.75rem',
            padding: '0.7rem 1.5rem',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: "'Nunito', system-ui, sans-serif",
          }}
        >
          Back to home
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
