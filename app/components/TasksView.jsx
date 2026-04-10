'use client';
import { useState, useMemo, useEffect } from 'react';

const TASKS_PER_PAGE = 20;

export default function TasksView({ group, tasks, onAdd, onToggle, onDelete }) {
  const [text, setText] = useState('');
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(tasks.length / TASKS_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);

  useEffect(() => {
    // Reset pagination when switching groups.
    setPage(0);
  }, [group?.id]);

  const visible = useMemo(() => {
    const start = safePage * TASKS_PER_PAGE;
    return tasks.slice(start, start + TASKS_PER_PAGE);
  }, [tasks, safePage]);

  const handleAdd = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setText('');
  };

  if (!group) {
    return <div className="empty-state">Select a group to view tasks.</div>;
  }

  return (
    <>
      <div className="add-task-row">
        <input
          type="text"
          placeholder={`Add a task to "${group.name}"...`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button onClick={handleAdd}>Add</button>
      </div>

      {tasks.length === 0 ? (
        <div className="empty-state">No tasks yet. Add one above!</div>
      ) : (
        <>
          <ul className="task-list">
            {visible.map((t) => (
              <li key={t.id} className={t.done ? 'done' : ''}>
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => onToggle(t.id)}
                />
                <span className="task-text">{t.text}</span>
                {t.source === 'gcal' && <span className="source-tag">Calendar</span>}
                <button className="del" onClick={() => onDelete(t.id)} title="Delete">
                  &#x2715;
                </button>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="task-pager">
              <button onClick={() => setPage(safePage - 1)} disabled={safePage === 0}>
                &lsaquo; Prev
              </button>
              <span>
                Page {safePage + 1} of {totalPages} &middot; {tasks.length} total
              </span>
              <button
                onClick={() => setPage(safePage + 1)}
                disabled={safePage >= totalPages - 1}
              >
                Next &rsaquo;
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
