'use client';
import { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import TasksView from './components/TasksView';
import CalendarImportModal from './components/CalendarImportModal';
import { api } from './lib/store';

export default function Home() {
  const [state, setState] = useState(null); // { groups, tasks }
  const [selectedId, setSelectedId] = useState(null);
  const [calOpen, setCalOpen] = useState(false);
  const [error, setError] = useState('');

  // Initial load from server
  useEffect(() => {
    api
      .loadState()
      .then((s) => {
        setState(s);
        setSelectedId(s.groups[0]?.id || null);
      })
      .catch((e) => setError(e.message));
  }, []);

  const selectedGroup = useMemo(
    () => state?.groups.find((g) => g.id === selectedId) || null,
    [state, selectedId]
  );

  const currentTasks = useMemo(
    () => (state && selectedId ? state.tasks[selectedId] || [] : []),
    [state, selectedId]
  );

  const taskCounts = useMemo(() => {
    if (!state) return {};
    const counts = {};
    for (const g of state.groups) counts[g.id] = (state.tasks[g.id] || []).length;
    return counts;
  }, [state]);

  // ----- group ops -----
  const addGroup = async (name) => {
    try {
      const newGroup = await api.createGroup(name);
      setState((s) => ({
        groups: [...s.groups, newGroup],
        tasks: { ...s.tasks, [newGroup.id]: [] },
      }));
    } catch (e) {
      setError(e.message);
    }
  };

  const deleteGroup = async (id) => {
    try {
      await api.deleteGroup(id);
      setState((s) => {
        const groups = s.groups.filter((g) => g.id !== id);
        const tasks = { ...s.tasks };
        delete tasks[id];
        return { groups, tasks };
      });
      if (selectedId === id) {
        const remaining = state.groups.filter((g) => g.id !== id);
        setSelectedId(remaining[0]?.id || null);
      }
    } catch (e) {
      setError(e.message);
    }
  };

  // ----- task ops -----
  const addTask = async (text) => {
    if (!selectedId) return;
    try {
      const task = await api.createTask(selectedId, text);
      setState((s) => ({
        ...s,
        tasks: { ...s.tasks, [selectedId]: [task, ...(s.tasks[selectedId] || [])] },
      }));
    } catch (e) {
      setError(e.message);
    }
  };

  const toggleTask = async (id) => {
    const current = currentTasks.find((t) => t.id === id);
    if (!current) return;
    const nextDone = !current.done;
    // Optimistic update
    setState((s) => ({
      ...s,
      tasks: {
        ...s.tasks,
        [selectedId]: s.tasks[selectedId].map((t) =>
          t.id === id ? { ...t, done: nextDone } : t
        ),
      },
    }));
    try {
      await api.toggleTask(id, nextDone);
    } catch (e) {
      setError(e.message);
      // Revert
      setState((s) => ({
        ...s,
        tasks: {
          ...s.tasks,
          [selectedId]: s.tasks[selectedId].map((t) =>
            t.id === id ? { ...t, done: !nextDone } : t
          ),
        },
      }));
    }
  };

  const deleteTask = async (id) => {
    try {
      await api.deleteTask(id);
      setState((s) => ({
        ...s,
        tasks: {
          ...s.tasks,
          [selectedId]: s.tasks[selectedId].filter((t) => t.id !== id),
        },
      }));
    } catch (e) {
      setError(e.message);
    }
  };

  const importCalendarEvents = async (events) => {
    if (!selectedId || events.length === 0) return;
    try {
      const { tasks: newTasks } = await api.importTasks(
        selectedId,
        events.map((e) => ({ text: e.summary, source: 'gcal' }))
      );
      setState((s) => ({
        ...s,
        tasks: {
          ...s.tasks,
          [selectedId]: [...newTasks, ...(s.tasks[selectedId] || [])],
        },
      }));
    } catch (e) {
      setError(e.message);
    }
  };

  if (!state) {
    return (
      <div style={{ padding: 40 }}>
        {error ? `Error: ${error}` : 'Loading…'}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        groups={state.groups}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAdd={addGroup}
        onDelete={deleteGroup}
        taskCounts={taskCounts}
      />

      <main className="main">
        <div className="main-header">
          <h1>{selectedGroup ? selectedGroup.name : 'Tasks'}</h1>
          <button className="gcal-btn" onClick={() => setCalOpen(true)} disabled={!selectedGroup}>
            <span className="gcal-dot" />
            Import from Google Calendar
          </button>
        </div>

        {error && (
          <div style={{
            background: '#ffe5e5', color: '#c0392b', padding: '8px 12px',
            borderRadius: 6, marginBottom: 12, fontSize: '0.85rem',
          }}>
            {error} <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>&times;</button>
          </div>
        )}

        <TasksView
          group={selectedGroup}
          tasks={currentTasks}
          onAdd={addTask}
          onToggle={toggleTask}
          onDelete={deleteTask}
        />
      </main>

      <CalendarImportModal
        open={calOpen}
        onClose={() => setCalOpen(false)}
        onImport={importCalendarEvents}
        targetGroupName={selectedGroup?.name}
      />
    </div>
  );
}
