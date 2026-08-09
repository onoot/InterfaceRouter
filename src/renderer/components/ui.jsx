import React, { useEffect, useRef, useState } from 'react';
import { IconClose, IconChevronDown } from './icons.jsx';

// UI-примитивы. Только представление; данные приходят через props/store.

export function Button({ children, onClick, variant, size, disabled, className, title, type = 'button' }) {
  const cls = ['btn'];
  if (variant) cls.push(`btn--${variant}`);
  if (size) cls.push(`btn--${size}`);
  if (className) cls.push(className);
  return (
    <button type={type} className={cls.join(' ')} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
}

export function Badge({ tone, dot, children, title }) {
  const cls = ['badge'];
  if (tone) cls.push(`badge--${tone}`);
  return (
    <span className={cls.join(' ')} title={title}>
      {dot ? <span className="badge__dot" /> : null}
      {children}
    </span>
  );
}

export function Chip({ active, onClick, children }) {
  return (
    <span className={`chip${active ? ' is-on' : ''}`} onClick={onClick} role={onClick ? 'button' : undefined} style={onClick ? { cursor: 'pointer' } : undefined}>
      {children}
    </span>
  );
}

export function Switch({ checked, onChange, title }) {
  return (
    <label className="switch" title={title}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch__track" />
    </label>
  );
}

export function Field({ label, required, hint, children }) {
  return (
    <div className="field">
      {label ? <label className="field__label">{label}{required ? ' <em>*</em>' : null}</label> : null}
      {children}
      {hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="seg" role="tablist" aria-label={label}>
      {options.map((opt) => (
        <button
          key={opt.value}
          role="tab"
          aria-selected={value === opt.value}
          className={value === opt.value ? 'is-active' : ''}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// Выпадающий список в стиле дизайна (нативный <select> не перекрашивается).
export function Select({ value, onChange, options, placeholder, disabled, title }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="sel" ref={ref}>
      <button
        type="button"
        className="sel__trigger"
        disabled={disabled}
        title={title}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`sel__value${current ? '' : ' is-empty'}`}>
          {current ? current.label : placeholder || 'Выберите…'}
        </span>
        <span className={`sel__chevron${open ? ' is-open' : ''}`}>
          <IconChevronDown width="15" height="15" />
        </span>
      </button>
      {open ? (
        <div className="sel__menu" role="listbox">
          {options.length === 0 ? (
            <div className="sel__empty">{placeholder || 'Нет вариантов'}</div>
          ) : (
            options.map((o) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                className={`sel__opt${o.value === value ? ' is-active' : ''}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {o.label}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export function Modal({ title, onClose, children, foot }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3 className="modal__title">{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <IconClose />
          </button>
        </div>
        {children}
        {foot ? <div className="modal__foot">{foot}</div> : null}
      </div>
    </div>
  );
}

export function Spinner({ large }) {
  return <span className={`spinner${large ? ' spinner--lg' : ''}`} aria-label="Загрузка" />;
}

export function EmptyState({ title, text }) {
  return (
    <div className="empty">
      <div className="empty__title">{title}</div>
      {text ? <div style={{ fontSize: 13.5 }}>{text}</div> : null}
    </div>
  );
}

export function timeFmt(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function dateFmt(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
