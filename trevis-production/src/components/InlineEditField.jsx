import { useState, useEffect, useRef } from 'react';
import { T, font } from '../parts/p2_helpers.jsx';

/**
 * InlineEditField Component
 * 
 * Provides click-to-edit functionality for various field types with auto-save on blur.
 * Shows optimistic UI updates and reverts on save failure.
 * 
 * Requirements: 8.10, 8.11, 8.12, 8.13
 * 
 * @param {Object} props
 * @param {any} props.value - Current field value
 * @param {string} props.type - Field type: 'text', 'phone', 'date', 'number', 'select', 'textarea'
 * @param {Function} props.onSave - Async function to save the value, returns { success: boolean, error?: string }
 * @param {Function} props.validation - Optional validation function, returns boolean
 * @param {Array} props.options - Options for select type (array of {value, label} objects)
 * @param {string} props.placeholder - Placeholder text when value is empty
 * @param {boolean} props.disabled - Whether the field is disabled
 * @param {Object} props.style - Additional styles for the container
 */
export default function InlineEditField({
  value,
  type = 'text',
  onSave,
  validation,
  options = [],
  placeholder = 'Click to edit',
  disabled = false,
  style = {}
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [originalValue, setOriginalValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showOptimistic, setShowOptimistic] = useState(false);
  const inputRef = useRef(null);

  // Update internal state when prop value changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
      setOriginalValue(value);
    }
  }, [value, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (type === 'text' || type === 'textarea') {
        inputRef.current.select();
      }
    }
  }, [isEditing, type]);

  const handleClick = () => {
    if (disabled || isSaving) return;
    setIsEditing(true);
    setError(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && type !== 'textarea') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleCancel = () => {
    setEditValue(originalValue);
    setIsEditing(false);
    setError(null);
    setShowOptimistic(false);
  };

  const handleSave = async () => {
    if (isSaving) return;

    // Validate if validation function provided
    if (validation && !validation(editValue)) {
      setError('Invalid value');
      return;
    }

    // No change, just exit edit mode
    if (editValue === originalValue) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);
    setShowOptimistic(true);

    try {
      const result = await onSave(editValue);
      
      if (result.success) {
        // Success - update original value and exit edit mode
        setOriginalValue(editValue);
        setIsEditing(false);
        setShowOptimistic(false);
      } else {
        // Save failed - revert to original value and show error
        setEditValue(originalValue);
        setError(result.error || 'Save failed');
        setShowOptimistic(false);
      }
    } catch (err) {
      // Exception during save - revert and show error
      setEditValue(originalValue);
      setError(err.message || 'Save failed');
      setShowOptimistic(false);
    }

    setIsSaving(false);
  };

  const handleBlur = () => {
    // Auto-save on blur
    if (isEditing) {
      handleSave();
    }
  };

  const formatDisplayValue = (val) => {
    if (val === null || val === undefined || val === '') {
      return placeholder;
    }

    switch (type) {
      case 'date':
        if (val) {
          try {
            const date = new Date(val);
            if (isNaN(date.getTime())) {
              return val; // Return original value if invalid date
            }
            return date.toLocaleDateString();
          } catch {
            return val;
          }
        }
        return placeholder;
      case 'number':
        return typeof val === 'number' ? val.toLocaleString() : val;
      case 'select':
        const option = options.find(opt => opt.value === val);
        return option ? option.label : val;
      case 'textarea':
        // Replace newlines with spaces for display
        return typeof val === 'string' ? val.replace(/\\n/g, ' ').replace(/\n/g, ' ') : val;
      default:
        return val;
    }
  };

  const renderInput = () => {
    const baseStyle = {
      width: '100%',
      background: T.surface,
      border: `1px solid ${error ? T.red : T.border}`,
      borderRadius: '6px',
      padding: type === 'textarea' ? '8px 12px' : '6px 12px',
      fontSize: '13px',
      color: T.text,
      fontFamily: font,
      outline: 'none',
      resize: type === 'textarea' ? 'vertical' : 'none',
      minHeight: type === 'textarea' ? '60px' : 'auto'
    };

    const focusStyle = {
      borderColor: T.gold,
      boxShadow: `0 0 0 2px ${T.goldDim}`
    };

    switch (type) {
      case 'textarea':
        return (
          <textarea
            ref={inputRef}
            value={editValue || ''}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            style={baseStyle}
            onFocus={(e) => Object.assign(e.target.style, focusStyle)}
            onBlur={(e) => {
              Object.assign(e.target.style, baseStyle);
              handleBlur();
            }}
          />
        );

      case 'select':
        return (
          <select
            ref={inputRef}
            value={editValue || ''}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            style={baseStyle}
            onFocus={(e) => Object.assign(e.target.style, focusStyle)}
          >
            <option value="">Select...</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'date':
        return (
          <input
            ref={inputRef}
            type="date"
            value={editValue || ''}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            style={baseStyle}
            onFocus={(e) => Object.assign(e.target.style, focusStyle)}
          />
        );

      case 'number':
        return (
          <input
            ref={inputRef}
            type="number"
            value={editValue || ''}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            style={baseStyle}
            onFocus={(e) => Object.assign(e.target.style, focusStyle)}
            step="0.01"
          />
        );

      case 'phone':
        return (
          <input
            ref={inputRef}
            type="tel"
            value={editValue || ''}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            style={baseStyle}
            onFocus={(e) => Object.assign(e.target.style, focusStyle)}
          />
        );

      default: // text
        return (
          <input
            ref={inputRef}
            type="text"
            value={editValue || ''}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            style={baseStyle}
            onFocus={(e) => Object.assign(e.target.style, focusStyle)}
          />
        );
    }
  };

  const containerStyle = {
    position: 'relative',
    minHeight: '24px',
    ...style
  };

  const displayStyle = {
    padding: type === 'textarea' ? '8px 12px' : '6px 12px',
    borderRadius: '6px',
    border: `1px solid transparent`,
    cursor: disabled ? 'default' : 'pointer',
    fontSize: '13px',
    color: (value === null || value === undefined || value === '') ? T.muted : T.text,
    fontFamily: font,
    background: disabled ? T.surface : 'transparent',
    transition: 'all 0.15s ease',
    minHeight: type === 'textarea' ? '60px' : 'auto',
    wordBreak: 'break-word',
    opacity: showOptimistic ? 0.7 : 1
  };

  const hoverStyle = {
    background: T.hover,
    border: `1px solid ${T.border}`
  };

  return (
    <div style={containerStyle}>
      {isEditing ? (
        <div>
          {renderInput()}
          {error && (
            <div style={{
              fontSize: '11px',
              color: T.red,
              marginTop: '4px',
              padding: '4px 8px',
              background: T.redDim,
              borderRadius: '4px'
            }}>
              {error}
            </div>
          )}
          {isSaving && (
            <div style={{
              fontSize: '11px',
              color: T.muted,
              marginTop: '4px',
              padding: '4px 8px'
            }}>
              Saving...
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={handleClick}
          style={displayStyle}
          onMouseEnter={(e) => {
            if (!disabled) {
              Object.assign(e.target.style, hoverStyle);
            }
          }}
          onMouseLeave={(e) => {
            Object.assign(e.target.style, displayStyle);
          }}
          title={disabled ? undefined : 'Click to edit'}
        >
          {showOptimistic ? formatDisplayValue(editValue) : formatDisplayValue(value)}
          {isSaving && (
            <span style={{ 
              marginLeft: '8px', 
              fontSize: '11px', 
              color: T.muted 
            }}>
              ⏳
            </span>
          )}
        </div>
      )}
    </div>
  );
}