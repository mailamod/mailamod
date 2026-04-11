// Client-side API wrapper for the SQLite-backed REST endpoints.
// All functions throw on non-2xx responses.

async function jsonFetch(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body.error) msg = body.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  loadState:    ()              => jsonFetch('/api/state'),

  createGroup:  (name)          => jsonFetch('/api/groups', {
                                     method: 'POST',
                                     body: JSON.stringify({ name }),
                                   }),

  deleteGroup:  (id)            => jsonFetch(`/api/groups/${id}`, {
                                     method: 'DELETE',
                                   }),

  createTask:   (groupId, text) => jsonFetch(`/api/groups/${groupId}/tasks`, {
                                     method: 'POST',
                                     body: JSON.stringify({ text }),
                                   }),

  importTasks:  (groupId, items) => jsonFetch(`/api/groups/${groupId}/tasks`, {
                                     method: 'POST',
                                     body: JSON.stringify({ items }),
                                   }),

  moveTask:     (id, status)    => jsonFetch(`/api/tasks/${id}`, {
                                     method: 'PATCH',
                                     body: JSON.stringify({ status }),
                                   }),

  deleteTask:   (id)            => jsonFetch(`/api/tasks/${id}`, {
                                     method: 'DELETE',
                                   }),

  createUser:   (data)          => jsonFetch('/api/users', {
                                     method: 'POST',
                                     body: JSON.stringify(data),
                                   }),
};
