import { Component } from 'react';
import ErrorBoundary from './ErrorBoundary.jsx';

/**
 * Manual Test Component for ErrorBoundary
 * 
 * This component can be used to manually test the ErrorBoundary functionality.
 * To test:
 * 1. Import this component in App.jsx
 * 2. Render <ErrorBoundaryTest /> somewhere in your app
 * 3. Click the "Trigger Error" button
 * 4. Verify the error boundary catches the error and displays fallback UI
 * 5. Click "Refresh Component" to remount
 */

class BuggyComponent extends Component {
  constructor(props) {
    super(props);
    this.state = { shouldThrow: false };
  }

  handleClick = () => {
    this.setState({ shouldThrow: true });
  };

  render() {
    if (this.state.shouldThrow) {
      // Intentionally throw an error to test ErrorBoundary
      throw new Error('Test error: This is an intentional error to test ErrorBoundary');
    }

    return (
      <div style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '4px', margin: '1rem' }}>
        <h3>ErrorBoundary Test Component</h3>
        <p>Click the button below to trigger an error and test the ErrorBoundary:</p>
        <button
          onClick={this.handleClick}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#dc3545',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Trigger Error
        </button>
      </div>
    );
  }
}

/**
 * Test wrapper component
 */
export default function ErrorBoundaryTest() {
  return (
    <div style={{ padding: '2rem' }}>
      <h2>ErrorBoundary Manual Test</h2>
      <p>This component tests the ErrorBoundary functionality.</p>
      
      <ErrorBoundary componentName="Test Component">
        <BuggyComponent />
      </ErrorBoundary>

      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#d4edda', borderRadius: '4px' }}>
        <h4>Expected Behavior:</h4>
        <ul>
          <li>✅ Click "Trigger Error" button</li>
          <li>✅ Error boundary should catch the error</li>
          <li>✅ Fallback UI should display with "Test Component Error" heading</li>
          <li>✅ Error should be logged to console with component name and stack trace</li>
          <li>✅ "Refresh Component" button should remount the component</li>
          <li>✅ Other parts of the application should continue working normally</li>
        </ul>
      </div>
    </div>
  );
}
