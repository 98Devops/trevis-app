import { Component } from 'react';
import { reportError } from '../lib/sentry.js';

/**
 * ErrorBoundary Component
 * 
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing
 * the entire application.
 * 
 * Requirements: 3.7, 3.8, 3.9
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  /**
   * Update state when an error is caught
   * Requirement 3.7: Catch errors in component tree
   */
  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error
    };
  }

  /**
   * Log error details to console
   * Requirement 3.8: Log error with component name and stack trace
   */
  componentDidCatch(error, errorInfo) {
    const componentName = this.props.componentName || 'Unknown Component';
    
    console.error(`[ErrorBoundary - ${componentName}] Error caught:`, {
      error: error,
      errorMessage: error.message,
      errorStack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    });

    // Forward boundary-caught errors to Sentry (no-op until a DSN is configured).
    // React swallows these, so the global handler wouldn't see them otherwise.
    reportError(error, { componentName, componentStack: errorInfo?.componentStack });

    this.setState({
      errorInfo
    });
  }

  /**
   * Reset error boundary and remount component
   * Requirement 3.9: Remount component with fresh data on refresh
   */
  handleRefresh = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      const componentName = this.props.componentName || 'Component';
      
      // Requirement 3.8: Display fallback UI with component name and refresh option
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          minHeight: '300px',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '8px',
          margin: '1rem'
        }}>
          <div style={{
            fontSize: '3rem',
            marginBottom: '1rem'
          }}>
            ⚠️
          </div>
          
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '600',
            marginBottom: '0.5rem',
            color: '#856404'
          }}>
            {componentName} Error
          </h2>
          
          <p style={{
            fontSize: '1rem',
            color: '#856404',
            marginBottom: '1.5rem',
            textAlign: 'center',
            maxWidth: '500px'
          }}>
            Something went wrong in the {componentName}. 
            The rest of the application is still working normally.
          </p>

          {this.state.error && (
            <details style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              backgroundColor: '#fff',
              border: '1px solid #ffc107',
              borderRadius: '4px',
              maxWidth: '600px',
              width: '100%'
            }}>
              <summary style={{
                cursor: 'pointer',
                fontWeight: '600',
                color: '#856404',
                marginBottom: '0.5rem'
              }}>
                Error Details
              </summary>
              <pre style={{
                fontSize: '0.875rem',
                color: '#721c24',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                marginTop: '0.5rem'
              }}>
                {this.state.error.toString()}
              </pre>
            </details>
          )}
          
          <button
            onClick={this.handleRefresh}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: '600',
              color: '#fff',
              backgroundColor: '#007bff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#0056b3'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#007bff'}
          >
            🔄 Refresh Component
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
