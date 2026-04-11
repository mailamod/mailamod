'use client';
import { useState, useEffect, useRef } from 'react';

export default function HamburgerMenu({ onAddUser }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="hamburger-wrap" ref={wrapRef}>
      <button
        className="hamburger-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Open menu"
        aria-expanded={open}
      >
        &#9776;
      </button>
      {open && (
        <div className="hamburger-dropdown">
          <button
            onClick={() => {
              setOpen(false);
              onAddUser();
            }}
          >
            Add User
          </button>
        </div>
      )}
    </div>
  );
}
