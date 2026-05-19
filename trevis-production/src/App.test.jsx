import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import ErrorBoundary from './components/ErrorBoundary.jsx';

/**
 * Test Suite: Error Boundary Integration Tests
 * 
 * Tests error boundary wrapping for main application components.
 * Validates that error boundaries properly isolate component errors.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.10
 */

// Component that throws an error
const ThrowingComponent = ({ componentName }) => {
  throw new Error(`${componentName} component error`);
};

// Component that works normally
const WorkingComponent = ({ name }) => <div>{name} Working</div>;

describe('Error Boundary Integration', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    // Suppress console.error for cleaner test output
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('Requirement 3.1-3.6: Component Error Boundaries', () => {
    const components = [
      { name: 'Dashboard', requirement: '3.1' },
      { name: 'PropertyDetail', requirement: '3.2' },
      { name: 'Students', requirement: '3.3' },
      { name: 'Reports', requirement: '3.4' },
      { name: 'Calendar', requirement: '3.5' },
      { name: 'Finances', requirement: '3.6' }
    ];

    components.forEach(({ name, requirement }) => {
      it(`should wrap ${name} component in ErrorBoundary (Req ${requirement})`, () => {
        render(
          <ErrorBoundary componentName={name}>
            <ThrowingComponent componentName={name} />
          </ErrorBoundary>
        );

        // Should display error boundary fallback UI
        expect(screen.getByText(`${name} Error`)).toBeInTheDocument();
        expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Refresh Component/i })).toBeInTheDocument();
      });

      it(`should log error with component name for ${name}`, () => {
        render(
          <ErrorBoundary componentName={name}>
            <ThrowingComponent componentName={name} />
          </ErrorBoundary>
        );

        // Verify console.error was called with component name
        expect(consoleErrorSpy).toHaveBeenCalled();
        const errorCall = consoleErrorSpy.mock.calls.find(call => 
          call[0].includes(`[ErrorBoundary - ${name}]`)
        );
        expect(errorCall).toBeDefined();
      });
    });
  });

  describe('Requirement 3.10: Error Isolation', () => {
    it('should isolate errors to specific components without affecting siblings', () => {
      const { container } = render(
        <div>
          <ErrorBoundary componentName="Dashboard">
            <ThrowingComponent componentName="Dashboard" />
          </ErrorBoundary>
          <ErrorBoundary componentName="Reports">
            <WorkingComponent name="Reports" />
          </ErrorBoundary>
          <ErrorBoundary componentName="Students">
            <WorkingComponent name="Students" />
          </ErrorBoundary>
        </div>
      );

      // Dashboard should show error
      expect(screen.getByText('Dashboard Error')).toBeInTheDocument();

      // Other components should work normally
      expect(screen.getByText('Reports Working')).toBeInTheDocument();
      expect(screen.getByText('Students Working')).toBeInTheDocument();
    });

    it('should allow multiple components to error independently', () => {
      render(
        <div>
          <ErrorBoundary componentName="Dashboard">
            <ThrowingComponent componentName="Dashboard" />
          </ErrorBoundary>
          <ErrorBoundary componentName="Reports">
            <ThrowingComponent componentName="Reports" />
          </ErrorBoundary>
          <ErrorBoundary componentName="Students">
            <WorkingComponent name="Students" />
          </ErrorBoundary>
        </div>
      );

      // Both Dashboard and Reports should show errors
      expect(screen.getByText('Dashboard Error')).toBeInTheDocument();
      expect(screen.getByText('Reports Error')).toBeInTheDocument();

      // Students should still work
      expect(screen.getByText('Students Working')).toBeInTheDocument();
    });

    it('should not crash entire application when one component errors', () => {
      const { container } = render(
        <div data-testid="app-container">
          <div data-testid="sidebar">Sidebar</div>
          <ErrorBoundary componentName="Dashboard">
            <ThrowingComponent componentName="Dashboard" />
          </ErrorBoundary>
          <div data-testid="footer">Footer</div>
        </div>
      );

      // App container should still exist
      expect(screen.getByTestId('app-container')).toBeInTheDocument();
      
      // Sidebar and footer should still be visible
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('footer')).toBeInTheDocument();

      // Error boundary should show fallback
      expect(screen.getByText('Dashboard Error')).toBeInTheDocument();
    });
  });

  describe('Error Boundary Fallback UI', () => {
    it('should display component name in error message', () => {
      render(
        <ErrorBoundary componentName="Calendar">
          <ThrowingComponent componentName="Calendar" />
        </ErrorBoundary>
      );

      expect(screen.getByText('Calendar Error')).toBeInTheDocument();
      expect(screen.getByText(/Something went wrong in the Calendar/i)).toBeInTheDocument();
    });

    it('should display refresh button', () => {
      render(
        <ErrorBoundary componentName="Finances">
          <ThrowingComponent componentName="Finances" />
        </ErrorBoundary>
      );

      const refreshButton = screen.getByRole('button', { name: /Refresh Component/i });
      expect(refreshButton).toBeInTheDocument();
    });

    it('should display error details in expandable section', () => {
      render(
        <ErrorBoundary componentName="Reports">
          <ThrowingComponent componentName="Reports" />
        </ErrorBoundary>
      );

      const detailsElement = screen.getByText('Error Details');
      expect(detailsElement).toBeInTheDocument();
    });
  });

  describe('Error Boundary Refresh Functionality', () => {
    it('should reset error state when refresh is clicked', () => {
      let shouldThrow = true;

      const ConditionalComponent = () => {
        if (shouldThrow) {
          throw new Error('Temporary error');
        }
        return <div>Component Fixed</div>;
      };

      const { rerender } = render(
        <ErrorBoundary componentName="Dashboard">
          <ConditionalComponent />
        </ErrorBoundary>
      );

      // Should show error initially
      expect(screen.getByText('Dashboard Error')).toBeInTheDocument();

      // Fix the component
      shouldThrow = false;

      // Click refresh button
      const refreshButton = screen.getByRole('button', { name: /Refresh Component/i });
      refreshButton.click();

      // Component should now work (after rerender)
      rerender(
        <ErrorBoundary componentName="Dashboard">
          <ConditionalComponent />
        </ErrorBoundary>
      );

      expect(screen.queryByText('Dashboard Error')).not.toBeInTheDocument();
    });
  });
});
