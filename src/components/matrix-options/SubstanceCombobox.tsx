'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';

export interface SubstanceComboboxOption {
  key: string;
  label: string;
}

export interface SubstanceComboboxProps {
  options: ReadonlyArray<SubstanceComboboxOption>;
  value: string;
  onChange: (key: string) => void;
  id?: string;
  label?: string;
  className?: string;
}

export function SubstanceCombobox({
  options,
  value,
  onChange,
  id = 'substance-combobox',
  label = 'Substance',
  className = '',
}: SubstanceComboboxProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const inputId = id;
  const listboxId = `${id}-listbox`;

  const selectedOption = useMemo(
    () => options.find((opt) => opt.key === value),
    [options, value]
  );

  useEffect(() => {
    if (!open) {
      setInputValue(selectedOption ? selectedOption.label : '');
    }
  }, [open, selectedOption]);

  const filteredOptions = useMemo(() => {
    if (!open) return options;
    const query = inputValue.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(query));
  }, [options, inputValue, open]);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (!open) setOpen(true);
    setActiveIndex(0);
  };

  const handleSelectOption = (option: SubstanceComboboxOption) => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    onChange(option.key);
    setInputValue(option.label);
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        // Open with an empty query so the full option list is shown (not filtered
        // down to the currently-selected label); the user types to filter.
        setOpen(true);
        setInputValue('');
        setActiveIndex(0);
      } else {
        setActiveIndex((prev) => Math.min(prev + 1, filteredOptions.length - 1));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (open) {
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      }
    } else if (e.key === 'Enter') {
      if (open && activeIndex >= 0 && activeIndex < filteredOptions.length) {
        e.preventDefault();
        handleSelectOption(filteredOptions[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
      setInputValue(selectedOption ? selectedOption.label : '');
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (
      containerRef.current &&
      e.relatedTarget instanceof Node &&
      containerRef.current.contains(e.relatedTarget)
    ) {
      return;
    }

    blurTimeoutRef.current = setTimeout(() => {
      setOpen(false);
      setActiveIndex(-1);
    }, 0);
  };

  const handleFocus = () => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
  };

  const activeOptionId =
    open && activeIndex >= 0 && activeIndex < filteredOptions.length
      ? `${inputId}-opt-${filteredOptions[activeIndex].key}`
      : undefined;

  return (
    <div
      className={`relative ${className}`}
      ref={containerRef}
      onBlur={handleBlur}
      onFocus={handleFocus}
    >
      <label
        id={`${inputId}-label`}
        htmlFor={inputId}
        className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1"
      >
        {label}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeOptionId}
        data-testid="substance-combobox-input"
        autoComplete="off"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onClick={() => {
          if (!open) {
            // Open showing the full list (empty query), consistent with ArrowDown-open.
            setOpen(true);
            setInputValue('');
            setActiveIndex(0);
          }
        }}
        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
      />

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-labelledby={`${inputId}-label`}
          className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg shadow-lg max-h-64 overflow-auto"
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => {
              const isActive = index === activeIndex;
              const isSelected = option.key === value;
              return (
                <li
                  key={option.key}
                  id={`${inputId}-opt-${option.key}`}
                  role="option"
                  aria-selected={isSelected}
                  data-testid={`substance-option-${option.key}`}
                  className={`px-3 py-2 cursor-pointer text-sm text-slate-800 dark:text-slate-200 ${
                    isActive
                      ? 'bg-sky-100 dark:bg-sky-900/40'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                  onClick={() => handleSelectOption(option)}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {option.label}
                </li>
              );
            })
          ) : (
            <li className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
              No matches
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
