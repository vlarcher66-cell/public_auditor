'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

interface Option {
  id: number | string;
  nome: string;
}

interface SearchSelectProps {
  value: number | string | '';
  onChange: (val: number | string | '') => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
}

export function SearchSelect({
  value, onChange, options, placeholder = 'Selecione...', disabled, className, required,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => String(o.id) === String(value));
  const filtered = options.filter((o) => o.nome.toLowerCase().includes(search.toLowerCase()));

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = Math.min(280, spaceBelow - 8);
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 200),
      zIndex: 99999,
      maxHeight: dropdownHeight > 100 ? dropdownHeight : 300,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
        setSearch('');
      }
    }
    function handleScroll() { updatePosition(); }
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  if (disabled) return (
    <div className={`text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50 text-gray-300 cursor-not-allowed w-full ${className ?? ''}`}>
      {selected ? selected.nome : placeholder}
    </div>
  );

  const dropdown = open ? (
    <div
      ref={dropdownRef}
      style={dropdownStyle}
      className="bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
    >
      <div className="p-2 border-b bg-gray-50">
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar..."
          className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      <div className="max-h-52 overflow-y-auto">
        {!required && (
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); setSearch(''); }}
            className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 border-b border-gray-100"
          >
            — {placeholder} —
          </button>
        )}
        {filtered.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => { onChange(o.id); setOpen(false); setSearch(''); }}
            className={`w-full text-left px-3 py-2 text-sm transition-colors
              ${String(value) === String(o.id)
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}`}
          >
            {o.nome}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="px-3 py-3 text-sm text-gray-400 text-center">Nenhum resultado</p>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className={`relative w-full ${className ?? ''}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!open && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const dropdownHeight = Math.min(280, spaceBelow - 8);
            setDropdownStyle({
              position: 'fixed',
              top: rect.bottom + 4,
              left: rect.left,
              width: Math.max(rect.width, 200),
              zIndex: 99999,
              maxHeight: dropdownHeight > 100 ? dropdownHeight : 300,
            });
          }
          setOpen(!open);
          setSearch('');
        }}
        className={`w-full text-sm border rounded-lg px-2.5 py-1.5 text-left flex items-center justify-between gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
          ${open ? 'border-blue-400 bg-white' : 'border-gray-300 bg-white hover:border-gray-400'}
          ${required && !value ? 'border-orange-300 bg-orange-50' : ''}`}
      >
        <span className={`truncate ${selected ? 'text-gray-800' : 'text-gray-400'}`}>
          {selected ? selected.nome : placeholder}
        </span>
        <ChevronDown size={14} className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {typeof document !== 'undefined' && createPortal(dropdown, document.body)}
    </div>
  );
}
