'use client';
import { useState } from 'react';

const COLUMNS = [
  { key: 'todo',       label: 'To Do' },
  { key: 'inprogress', label: 'In Progress' },
  { key: 'done',       label: 'Completed' },
];

export default function TasksView({ group, tasks, onAdd, onMove, onDelete }) {
  const [text, setText] = useState('');

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

      <div className="board">
        {COLUMNS.map((col, colIndex) => {
          const colTasks = tasks.filter((t) => (t.status || 'todo') === col.key);
          return (
            <div key={col.key} className="board-col">
              <div className="board-col-header">
                <span className="board-col-title">{col.label}</span>
                <span className="count-badge">{colTasks.length}</span>
              </div>

              {colTasks.length === 0 ? (
                <p className="board-col-empty">No tasks</p>
              ) : (
                colTasks.map((t) => (
                  <div key={t.id} className="task-card">
                    <span className="task-card-text">{t.text}</span>
                    {t.source === 'gcal' && (
                      <span className="source-tag">Calendar</span>
                    )}
                    <div className="task-card-actions">
                      <button
                        className="move-btn"
                        title="Move left"
                        disabled={colIndex === 0}
                        onClick={() => onMove(t.id, COLUMNS[colIndex - 1].key)}
                      >
                        ←
                      </button>
                      <button
                        className="move-btn"
                        title="Move right"
                        disabled={colIndex === COLUMNS.length - 1}
                        onClick={() => onMove(t.id, COLUMNS[colIndex + 1].key)}
                      >
                        →
                      </button>
                      <button
                        className="del"
                        title="Delete"
                        onClick={() => onDelete(t.id)}
                      >
                        &#x2715;
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
