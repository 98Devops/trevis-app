import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import InlineEditField from './InlineEditField.jsx';

describe('InlineEditField', () => {
  let mockOnSave;
  let user;

  beforeEach(() => {
    mockOnSave = vi.fn();
    user = userEvent.setup();
  });

  describe('Basic Functionality', () => {
    it('displays the current value', () => {
      render(
        <InlineEditField
          value="Test Value"
          type="text"
          onSave={mockOnSave}
        />
      );

      expect(screen.getByText('Test Value')).toBeInTheDocument();
    });

    it('shows placeholder when value is empty', () => {
      render(
        <InlineEditField
          value=""
          type="text"
          onSave={mockOnSave}
          placeholder="Click to edit"
        />
      );

      expect(screen.getByText('Click to edit')).toBeInTheDocument();
    });

    it('enters edit mode when clicked', async () => {
      render(
        <InlineEditField
          value="Test Value"
          type="text"
          onSave={mockOnSave}
        />
      );

      await user.click(screen.getByText('Test Value'));
      
      expect(screen.getByDisplayValue('Test Value')).toBeInTheDocument();
    });

    it('does not enter edit mode when disabled', async () => {
      render(
        <InlineEditField
          value="Test Value"
          type="text"
          onSave={mockOnSave}
          disabled={true}
        />
      );

      await user.click(screen.getByText('Test Value'));
      
      expect(screen.queryByDisplayValue('Test Value')).not.toBeInTheDocument();
    });
  });

  describe('Text Input Type', () => {
    it('allows text editing', async () => {
      render(
        <InlineEditField
          value="Original"
          type="text"
          onSave={mockOnSave}
        />
      );

      await user.click(screen.getByText('Original'));
      const input = screen.getByDisplayValue('Original');
      
      await user.clear(input);
      await user.type(input, 'New Value');
      
      expect(input.value).toBe('New Value');
    });

    it('saves on Enter key', async () => {
      mockOnSave.mockResolvedValue({ success: true });

      render(
        <InlineEditField
          value="Original"
          type="text"
          onSave={mockOnSave}
        />
      );

      await user.click(screen.getByText('Original'));
      const input = screen.getByDisplayValue('Original');
      
      await user.clear(input);
      await user.type(input, 'New Value');
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('New Value');
      });
    });

    it('cancels on Escape key', async () => {
      render(
        <InlineEditField
          value="Original"
          type="text"
          onSave={mockOnSave}
        />
      );

      await user.click(screen.getByText('Original'));
      const input = screen.getByDisplayValue('Original');
      
      await user.clear(input);
      await user.type(input, 'New Value');
      await user.keyboard('{Escape}');
      
      expect(screen.getByText('Original')).toBeInTheDocument();
      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  describe('Phone Input Type', () => {
    it('renders phone input correctly', async () => {
      render(
        <InlineEditField
          value="+263771234567"
          type="phone"
          onSave={mockOnSave}
        />
      );

      await user.click(screen.getByText('+263771234567'));
      const input = screen.getByDisplayValue('+263771234567');
      
      expect(input.type).toBe('tel');
    });
  });

  describe('Date Input Type', () => {
    it('renders date input correctly', async () => {
      render(
        <InlineEditField
          value="2024-01-15"
          type="date"
          onSave={mockOnSave}
        />
      );

      // Date should be formatted for display (format may vary by locale)
      const dateText = screen.getByText(/15\/01\/2024|1\/15\/2024/);
      expect(dateText).toBeInTheDocument();

      await user.click(dateText);
      const input = screen.getByDisplayValue('2024-01-15');
      
      expect(input.type).toBe('date');
    });

    it('handles invalid date gracefully', () => {
      render(
        <InlineEditField
          value="invalid-date"
          type="date"
          onSave={mockOnSave}
        />
      );

      expect(screen.getByText('invalid-date')).toBeInTheDocument();
    });
  });

  describe('Number Input Type', () => {
    it('renders number input correctly', async () => {
      render(
        <InlineEditField
          value={1234.56}
          type="number"
          onSave={mockOnSave}
        />
      );

      // Number should be formatted for display
      expect(screen.getByText('1,234.56')).toBeInTheDocument();

      await user.click(screen.getByText('1,234.56'));
      const input = screen.getByDisplayValue('1234.56');
      
      expect(input.type).toBe('number');
    });
  });

  describe('Select Input Type', () => {
    const options = [
      { value: 'cash', label: 'Cash' },
      { value: 'ecocash', label: 'EcoCash' },
      { value: 'bank', label: 'Bank Transfer' }
    ];

    it('renders select input correctly', async () => {
      render(
        <InlineEditField
          value="cash"
          type="select"
          options={options}
          onSave={mockOnSave}
        />
      );

      // Should display the label for the selected value
      expect(screen.getByText('Cash')).toBeInTheDocument();

      await user.click(screen.getByText('Cash'));
      const select = screen.getByRole('combobox');
      
      expect(select.value).toBe('cash');
    });

    it('allows selecting different options', async () => {
      mockOnSave.mockResolvedValue({ success: true });

      render(
        <InlineEditField
          value="cash"
          type="select"
          options={options}
          onSave={mockOnSave}
        />
      );

      await user.click(screen.getByText('Cash'));
      const select = screen.getByRole('combobox');
      
      await user.selectOptions(select, 'ecocash');
      fireEvent.blur(select);
      
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('ecocash');
      });
    });
  });

  describe('Textarea Input Type', () => {
    it('formats display value correctly for textarea', () => {
      render(
        <InlineEditField
          value="Multi-line\ntext content"
          type="textarea"
          onSave={mockOnSave}
        />
      );

      // The component should format the display value by replacing newlines with spaces
      // Let's check if this is working by looking for the formatted text
      const displayElement = screen.getByTitle('Click to edit');
      expect(displayElement.textContent).toBe('Multi-line text content');
    });

    it('renders textarea correctly', async () => {
      const multilineValue = 'Multi-line\ntext content';
      
      render(
        <InlineEditField
          value={multilineValue}
          type="textarea"
          onSave={mockOnSave}
        />
      );

      // Click to enter edit mode using the title attribute
      const displayElement = screen.getByTitle('Click to edit');
      await user.click(displayElement);
      
      // Should render as textarea in edit mode with original newlines
      const textarea = screen.getByRole('textbox');
      expect(textarea.tagName).toBe('TEXTAREA');
      expect(textarea.value).toBe(multilineValue);
    });

    it('does not save on Enter key for textarea', async () => {
      render(
        <InlineEditField
          value="Original"
          type="textarea"
          onSave={mockOnSave}
        />
      );

      await user.click(screen.getByText('Original'));
      const textarea = screen.getByDisplayValue('Original');
      
      await user.type(textarea, '\nNew line');
      await user.keyboard('{Enter}');
      
      // Should not save, Enter adds new line in textarea
      expect(mockOnSave).not.toHaveBeenCalled();
      expect(textarea.value).toContain('\n');
    });
  });

  describe('Auto-save on Blur', () => {
    it('saves when input loses focus', async () => {
      mockOnSave.mockResolvedValue({ success: true });

      render(
        <div>
          <InlineEditField
            value="Original"
            type="text"
            onSave={mockOnSave}
          />
          <button>Other Element</button>
        </div>
      );

      await user.click(screen.getByText('Original'));
      const input = screen.getByDisplayValue('Original');
      
      await user.clear(input);
      await user.type(input, 'New Value');
      await user.click(screen.getByText('Other Element'));
      
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('New Value');
      });
    });

    it('does not save if value unchanged', async () => {
      render(
        <div>
          <InlineEditField
            value="Original"
            type="text"
            onSave={mockOnSave}
          />
          <button>Other Element</button>
        </div>
      );

      await user.click(screen.getByText('Original'));
      await user.click(screen.getByText('Other Element'));
      
      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  describe('Optimistic UI Updates', () => {
    it('shows optimistic update during save', async () => {
      let resolvePromise;
      const savePromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockOnSave.mockReturnValue(savePromise);

      const TestComponent = () => {
        const [value, setValue] = useState('Original');
        
        const handleSave = async (newValue) => {
          const result = await mockOnSave(newValue);
          if (result.success) {
            setValue(newValue); // Parent updates value on successful save
          }
          return result;
        };

        return (
          <InlineEditField
            value={value}
            type="text"
            onSave={handleSave}
          />
        );
      };

      render(<TestComponent />);

      await user.click(screen.getByText('Original'));
      const input = screen.getByDisplayValue('Original');
      
      await user.clear(input);
      await user.type(input, 'New Value');
      await user.keyboard('{Enter}');
      
      // Should show saving indicator while save is in progress
      expect(screen.getByText('Saving...')).toBeInTheDocument();
      
      // Resolve the save
      resolvePromise({ success: true });
      
      await waitFor(() => {
        expect(screen.queryByText('Saving...')).not.toBeInTheDocument();
        // After successful save, component exits edit mode and shows new value
        expect(screen.getByText('New Value')).toBeInTheDocument();
        expect(screen.queryByDisplayValue('New Value')).not.toBeInTheDocument();
      });
    });

    it('reverts on save failure', async () => {
      mockOnSave.mockResolvedValue({ success: false, error: 'Save failed' });

      render(
        <InlineEditField
          value="Original"
          type="text"
          onSave={mockOnSave}
        />
      );

      await user.click(screen.getByText('Original'));
      const input = screen.getByDisplayValue('Original');
      
      await user.clear(input);
      await user.type(input, 'New Value');
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        // Component stays in edit mode with reverted value and error message
        expect(screen.getByDisplayValue('Original')).toBeInTheDocument();
        expect(screen.getByText('Save failed')).toBeInTheDocument();
      });
    });

    it('reverts on save exception', async () => {
      mockOnSave.mockRejectedValue(new Error('Network error'));

      render(
        <InlineEditField
          value="Original"
          type="text"
          onSave={mockOnSave}
        />
      );

      await user.click(screen.getByText('Original'));
      const input = screen.getByDisplayValue('Original');
      
      await user.clear(input);
      await user.type(input, 'New Value');
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        // Component stays in edit mode with reverted value and error message
        expect(screen.getByDisplayValue('Original')).toBeInTheDocument();
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('Validation', () => {
    it('validates input before saving', async () => {
      const validation = vi.fn().mockReturnValue(false);

      render(
        <InlineEditField
          value="Original"
          type="text"
          onSave={mockOnSave}
          validation={validation}
        />
      );

      await user.click(screen.getByText('Original'));
      const input = screen.getByDisplayValue('Original');
      
      await user.clear(input);
      await user.type(input, 'Invalid Value');
      await user.keyboard('{Enter}');
      
      expect(validation).toHaveBeenCalledWith('Invalid Value');
      expect(screen.getByText('Invalid value')).toBeInTheDocument();
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('saves when validation passes', async () => {
      const validation = vi.fn().mockReturnValue(true);
      mockOnSave.mockResolvedValue({ success: true });

      render(
        <InlineEditField
          value="Original"
          type="text"
          onSave={mockOnSave}
          validation={validation}
        />
      );

      await user.click(screen.getByText('Original'));
      const input = screen.getByDisplayValue('Original');
      
      await user.clear(input);
      await user.type(input, 'Valid Value');
      await user.keyboard('{Enter}');
      
      expect(validation).toHaveBeenCalledWith('Valid Value');
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('Valid Value');
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper cursor styles', () => {
      render(
        <InlineEditField
          value="Test Value"
          type="text"
          onSave={mockOnSave}
        />
      );

      const display = screen.getByText('Test Value');
      expect(display).toHaveStyle({ cursor: 'pointer' });
    });

    it('shows disabled cursor when disabled', () => {
      render(
        <InlineEditField
          value="Test Value"
          type="text"
          onSave={mockOnSave}
          disabled={true}
        />
      );

      const display = screen.getByText('Test Value');
      expect(display).toHaveStyle({ cursor: 'default' });
    });

    it('focuses input when entering edit mode', async () => {
      render(
        <InlineEditField
          value="Test Value"
          type="text"
          onSave={mockOnSave}
        />
      );

      await user.click(screen.getByText('Test Value'));
      const input = screen.getByDisplayValue('Test Value');
      
      expect(input).toHaveFocus();
    });
  });
});