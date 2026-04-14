import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import CategoryIcon from './CategoryIcon';

export default function CategorySelect({ categories, value, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="cat-select" ref={ref}>
      <button
        type="button"
        className={`cat-select-trigger ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setOpen(o => !o)}
      >
        <span className="cat-select-selected">
          <CategoryIcon name={value} size={14} />
          <span className="cat-select-label">{value}</span>
        </span>
        {!disabled && (
          <ChevronDown size={13} strokeWidth={1.6} color="#c8ddd5"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '0.18s ease', flexShrink: 0 }} />
        )}
      </button>
      {open && !disabled && (
        <div className="cat-select-menu">
          {categories.map(c => (
            <div
              key={c.name}
              className={`cat-select-item ${value === c.name ? 'active' : ''}`}
              onClick={() => { onChange(c.name); setOpen(false); }}
            >
              <CategoryIcon name={c.name} size={14} />
              <span className="cat-select-label">{c.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
