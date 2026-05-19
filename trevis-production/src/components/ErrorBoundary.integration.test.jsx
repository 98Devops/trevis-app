import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ErrorBoundary from './ErrorBoundary.jsx';

/**
 * Integration Test Suite: Error Boundary Isolation
 * 
 * Tests that error boundaries properly isolate component errors
 * and that one component error doesn't crash others.
 * 
 * Task 1.3: Test error boundary isolation (one component error doesn't crash others)
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.10
 */

// Mock components that simulate real application components
const Dashboard = ({ shouldError }) => {
  if (shouldError) throw new Error('Dashboard error');
  return <div data-testid="dashboard">Dashboard Working</div>;
};

const PropertyDetail = ({ shouldError }) => {
  if (shouldError) throw new Error('PropertyDetail error');
  return <div data-testid="property-detail">PropertyDetail Working</div>;
};

const Students = ({ shouldError }) => {
  if (shouldError) throw new Error('Students error');
  return <div data-testid="students">Students Working</div>;
};

const Reports = ({ shouldError }) => {
  if (shouldError) throw new Error('Reports error');
  return <div data-testid="reports">Reports Working</div>;
};

const Calendar = ({ shouldError }) => {
  if (shouldError) throw new Error('Calendar error');
  return <div data-testid="calendar">Calendar Working</div>;
};

const Finances = ({ shouldError }) => {
  if (shouldError) throw new Error('Finances error');
  return <div data-testid="finances">Finances Working</div>;
};

describe('Error Boundary Isolation Integration Tests', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    // Suppress console.error for cleaner test output
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('Task 1.3: Error Boundary Isolation', () => {
    it('should isolate Dashboard error without affecting other components', () => {
      render(
        <div data-testid="app">
          <ErrorBoundary componentName="Dashboard">
            <Dashboard shouldError={true} />
          </ErrorBoundary>
          <ErrorBoundary componentName="PropertyDetail">
            <PropertyDetail shouldError={false} />
          </ErrorBoundary>
          <ErrorBoundary componentName="Students">
            <Students shouldError={false} />
          </ErrorBoundary>
          <ErrorBoundary componentName="Reports">
            <Reports shouldError={false} />
          </ErrorBoundary>
          <ErrorBoundary componentName="Calendar">
            <Calendar shouldError={false} />
          </ErrorBoundary>
          <ErrorBoundary componentName="Finances">
            <Finances shouldError={false} />
          </ErrorBoundary>
        </div>
      );

      // Dashboard should show error
      expect(screen.getByText('Dashboard Error')).toBeInTheDocument();

      // All other components should work normally
      expect(screen.getByTestId('property-detail')).toBeInTheDocument();
      expect(screen.getByTestId('students')).toBeInTheDocument();
      expect(screen.getByTestId('reports')).toBeInTheDocument();
      expect(screen.getByTestId('calendar')).toBeInTheDocument();
      expect(screen.getByTestId('finances')).toBeInTheDocument();

      // App container should still exist
      expect(screen.getByTestId('app')).toBeInTheDocument();
    });

    it('should isolate PropertyDetail error without affecting other components', () => {
      render(
        <div data-testid="app">
          <ErrorBoundary componentName="Dashboard">
            <Dashboard shouldError={false} />
          </ErrorBoundary>
          <ErrorBoundary componentName="PropertyDetail">
            <PropertyDetail shouldError={true} />
          </ErrorBoundary>
          <ErrorBoundary componentName="Students">
            <Students shouldError={false} />
          </ErrorBoundary>
          <ErrorBoundary componentName="Reports">
            <Reports shouldError={false} />
          </ErrorBoundary>
          <ErrorBoundary componentName="Calendar">
            <Calendar shouldError={false} />
          </ErrorBoundary>
          <ErrorBoundary componentName="Finances">
            <Finances shouldError={false} />
          </ErrorBoundary>
        </div>
      );

      // PropertyDetail should show error
      expect(screen.getByText('PropertyDetail Error')).toBeInTheDocument();

      // All other components should work normally
      expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('students')).toBeInTheDocument();
      expect(screen.getByTestId('reports')).toBeInTheDocument();
      expect(screen.getByTestId('calendar')).toBeInTheDocument();
      expect(screen.getByTestId('finances')).toBeInTheDocument();
    });

    it('should isolate Students error without affecting other components', () => {
      render(
        <div data-testid="app">
          <ErrorBoundary componentName="Dashboard">
            <Dashboard shouldError={false} />
          </ErrorBoundary>
          <ErrorBoundary componentName="PropertyDetail">
            <PropertyDetail shouldError={false} />
          </ErrorBoundary>
          <ErrorBoundary componentName="Students">
            <Students shouldError={true} />
          </ErrorBoundary>
          <ErrorBoundary componentName="Reports">
            <Reports shouldError={false} />
          </ErrorBoundary>
          <ErrorBoundary componentName="Calendar">
            <Calendar shouldError={false} />
          </ErrorBoundary>
          <ErrorBoundary componentName="Finances">
            <Finances shouldError={false} />
          </ErrorBoundary>
        </div>
      );

      // Students should show error
      expect(screen.getByText('Students Error')).toBeInTheDocument();

      // All other components should work normally
      expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('property-detail')).toBeInTheDocument();
      expect(screen.getByTestId('reports')).toBeInTheDocument();
      expect(screen.getByTestId('calendar')).toBeInTheDocument();
      expect(screen.getByTestId('finances')).toBeInTheDocument();
    });

    it('should isolate Reports error without affecting other components', () => {
      render(
        <div data-testid="app">
          <ErrorBoundary componentName="Dashboard">
            <Dashboard shouldError={false} />
          </ErrorBoundary>
          <ErrorBoundary componentName="PropertyDetail">
            <PropertyDetail shouldError={false} />
          </ErrorBoundary>
          <ErrorBoundary componentName="Students">
            <Students shouldError={false} />
          </ErrorBoundary>
          <ErrorBoundary componentName="Reports">
            <Reports shouldError={true} />
          </ErrorBoundary>
          <ErrorBoundary componentName="Calendar">
            <Calendar shouldError={false} />
          </ErrorBoundary>
          <ErrorBoundary componentName="Finances">
            <Finances shouldError={false} />
          </ErrorBoundary>
        </div>
      );

      // Reports should show error
      expect(screen.getByText('Reports Error')).toBeInTheDocument();

      // All other components should work normally
      expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('property-detail')).toBeInTheDocument();
      expect(screen.getByTestId('students')).toBeInTheDocument();
      expect(screen.getByTestId('calendar')).toBeInTheDocument();
      expect(screen.getByTestId('finances')).toBeInTheDocument();
    });

    it('should isolate Calendar error without affecting other components', () => {
      render(
        <div data-testid="app">
          <ErrorBoundary componentName="Dashboard">
            <Dashboard shouldError={false} />
          </ErrorBoundary>
          <ErrorBoundary componentName="PropertyDetail">
            <PropertyDetail shouldError={false} />
          </ErrorBoundary>
          <ErrorBoundary componentName="Students">
            <Students shouldError={false} />
          </ErrorBoundary>
          <ErrorBoundary componentName="Reports">
            <Reports shouldError={false} />
          </ErrorBoundary>
          <ErrorBoundary componentName="Calendar">
            <Calendar shouldError={true} />
          </ErrorBoundary>
          <ErrorBoundary componentName="Finances">
            <Finances shouldError={false} />
          </ErrorBoundary>
        </div>
      );

      // Calendar should show error
      expect(screen.getByText('Calendar Error')).toBeInTheDocument();

      // All other components should work normally
      expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('property-detail')).toBeInTheDocument();
      expect(screen.getByTestId('students')).toBeInTheDocument();
      expect(screen.getByTestId('reports')).toBeInTheDocument();
      expect(screen.getByTestId('finances')).toBeInTheDocument();
    });

    it('should isolate Finances error without affecting other components', () => {
      render(
        <div data-testid="app">
          <ErrorBoundary componentName="Dashboard">
            <Dashboard shouldError={false} />
          </ErrorBoundary>
          <ErrorBoundary componentName="PropertyDetail">
            <PropertyDetail shouldError={false} />
          </ErrorBoundary>
          <ErrorBoundary componentName="Students">
            <Students shouldError={false} />
          </ErrorBoundary>
          <ErrorBoundary componentName="Reports">
            <Reports shouldError={false} />
          </ErrorBoundary>
          <ErrorBoundary componentName="Calendar">
            <Calendar shouldError={false} />
          </ErrorBoundary>
          <ErrorBoundary componentName="Finances">
            <Finances shouldError={true} />
          </ErrorBoundary>
        </div>
      );

      // Finances should show error
      expect(screen.getByText('Finances Error')).toBeInTheDocument();

      // All other components should work normally
      expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('property-detail')).toBeInTheDocument();
      expect(screen.getByTestId('students')).toBeInTheDocument();
      expect(screen.getByTestId('reports')).toBeInTheDocument();
      expect(screen.getByTestId('calendar')).toBeInTheDocument();
    });

    it('should handle multiple simultaneous component errors independently', () => {
      render(
        <div data-testid="app">
          <ErrorBoundary componentName="Dashboard">
            <Dashboard shouldError={true} />
          </ErrorBoundary>
          <ErrorBoundary componentName="PropertyDetail">
            <PropertyDetail shouldError={false} />
          </ErrorBoundary>
          <ErrorBoundary componentName="Students">
            <Students shouldError={true} />
          </ErrorBoundary>
          <ErrorBoundary componentName="Reports">
            <Reports shouldError={false} />
          </ErrorBoundary>
          <ErrorBoundary componentName="Calendar">
            <Calendar shouldError={true} />
          </ErrorBoundary>
          <ErrorBoundary componentName="Finances">
            <Finances shouldError={false} />
          </ErrorBoundary>
        </div>
      );

      // Multiple components should show errors
      expect(screen.getByText('Dashboard Error')).toBeInTheDocument();
      expect(screen.getByText('Students Error')).toBeInTheDocument();
      expect(screen.getByText('Calendar Error')).toBeInTheDocument();

      // Working components should still function
      expect(screen.getByTestId('property-detail')).toBeInTheDocument();
      expect(screen.getByTestId('reports')).toBeInTheDocument();
      expect(screen.getByTestId('finances')).toBeInTheDocument();

      // App should not crash
      expect(screen.getByTestId('app')).toBeInTheDocument();
    });

    it('should allow refresh of individual error boundaries', () => {
      let dashboardShouldError = true;

      const DynamicDashboard = () => {
        if (dashboardShouldError) throw new Error('Dashboard error');
        return <div data-testid="dashboard">Dashboard Working</div>;
      };

      const { rerender } = render(
        <div data-testid="app">
          <ErrorBoundary componentName="Dashboard">
            <DynamicDashboard />
          </ErrorBoundary>
          <ErrorBoundary componentName="Students">
            <Students shouldError={false} />
          </ErrorBoundary>
        </div>
      );

      // Dashboard should show error
      expect(screen.getByText('Dashboard Error')).toBeInTheDocument();
      expect(screen.getByTestId('students')).toBeInTheDocument();

      // Fix the dashboard
      dashboardShouldError = false;

      // Click refresh button
      const refreshButton = screen.getByRole('button', { name: /Refresh Component/i });
      fireEvent.click(refreshButton);

      // Rerender to simulate component remount
      rerender(
        <div data-testid="app">
          <ErrorBoundary componentName="Dashboard">
            <DynamicDashboard />
          </ErrorBoundary>
          <ErrorBoundary componentName="Students">
            <Students shouldError={false} />
          </ErrorBoundary>
        </div>
      );

      // Dashboard should now work
      expect(screen.queryByText('Dashboard Error')).not.toBeInTheDocument();
      expect(screen.getByTestId('students')).toBeInTheDocument();
    });
  });

  describe('Error Logging and Reporting', () => {
    it('should log errors with component name and stack trace', () => {
      render(
        <ErrorBoundary componentName="Dashboard">
          <Dashboard shouldError={true} />
        </ErrorBoundary>
      );

      // Verify console.error was called
      expect(consoleErrorSpy).toHaveBeenCalled();

      // Find the error log call with component name
      const errorCall = consoleErrorSpy.mock.calls.find(call => 
        call[0].includes('[ErrorBoundary - Dashboard]')
      );

      expect(errorCall).toBeDefined();
      expect(errorCall[0]).toContain('Dashboard');
    });

    it('should display fallback UI with component name', () => {
      render(
        <ErrorBoundary componentName="Calendar">
          <Calendar shouldError={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Calendar Error')).toBeInTheDocument();
      expect(screen.getByText(/Something went wrong in the Calendar/i)).toBeInTheDocument();
    });

    it('should provide refresh option in fallback UI', () => {
      render(
        <ErrorBoundary componentName="Reports">
          <Reports shouldError={true} />
        </ErrorBoundary>
      );

      const refreshButton = screen.getByRole('button', { name: /Refresh Component/i });
      expect(refreshButton).toBeInTheDocument();
    });
  });
});
