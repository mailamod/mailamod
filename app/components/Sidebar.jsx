'use client';
import { useState } from 'react';

const GROUPS_PER_PAGE = 10;

export default function Sidebar({ groups, selectedId, onSelect, onAdd, onDelete, taskCounts }) {
  const [name, setName] = useState('');
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(groups.length / GROUPS_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * GROUPS_PER_PAGE;
  const visible = groups.slice(start, start + GROUPS_PER_PAGE);

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setName('');
    // jump to last page so the new group is visible
    const newTotal = Math.ceil((groups.length + 1) / GROUPS_PER_PAGE);
    setPage(newTotal - 1);
  };

  return (
    <aside className="sidebar">
      <h2>Groups</h2>

      <div className="add-group-row">
        <input
          type="text"
          placeholder="New group..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button onClick={handleAdd}>+</button>
      </div>

      <ul className="group-list">
        {visible.map((g) => (
          <li
            key={g.id}
            className={g.id === selectedId ? 'selected' : ''}
            onClick={() => onSelect(g.id)}
          >
            <span>{g.name}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="count-badge">{taskCounts[g.id] || 0}</span>
              {groups.length > 1 && (
                <button
                  className="del"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(g.id);
                  }}
                  title="Delete group"
                >
                  &#x2715;
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <div className="pager">
          <button onClick={() => setPage(safePage - 1)} disabled={safePage === 0}>
            &lsaquo;
          </button>
          <span>
            {safePage + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(safePage + 1)}
            disabled={safePage >= totalPages - 1}
          >
            &rsaquo;
          </button>
        </div>
      )}
    </aside>
  );
}
