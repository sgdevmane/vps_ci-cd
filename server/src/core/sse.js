const triggerClients = new Map(); // triggerId -> Set of express res objects
const globalClients = new Set(); // Set of express res objects

/**
 * Register a client response stream for a specific trigger ID
 */
export function addTriggerSubscriber(triggerId, res) {
  const id = String(triggerId);
  if (!triggerClients.has(id)) {
    triggerClients.set(id, new Set());
  }
  triggerClients.get(id).add(res);

  // Send SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable Nginx proxy buffering for instant delivery
  });
  res.write(`event: connected\ndata: ${JSON.stringify({ triggerId: id })}\n\n`);

  res.on('close', () => {
    removeTriggerSubscriber(id, res);
  });
}

export function removeTriggerSubscriber(triggerId, res) {
  const id = String(triggerId);
  const set = triggerClients.get(id);
  if (set) {
    set.delete(res);
    if (set.size === 0) triggerClients.delete(id);
  }
}

/**
 * Register a client response stream for global system events
 */
export function addGlobalSubscriber(res) {
  globalClients.add(res);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`event: connected\ndata: ${JSON.stringify({ type: 'global' })}\n\n`);

  res.on('close', () => {
    globalClients.delete(res);
  });
}

/**
 * Broadcast a new log line or chunk to all active subscribers of a trigger
 */
export function broadcastLogChunk(triggerId, chunk) {
  const id = String(triggerId);
  const set = triggerClients.get(id);
  if (!set || set.size === 0) return;
  const data = JSON.stringify({ chunk, timestamp: new Date().toISOString() });
  for (const client of set) {
    try {
      client.write(`event: log\ndata: ${data}\n\n`);
    } catch {
      set.delete(client);
    }
  }
}

/**
 * Broadcast trigger state transitions (queued -> running -> success/failed)
 */
export function broadcastTriggerStatus(triggerId, status, extra = {}) {
  const id = String(triggerId);
  const data = JSON.stringify({ triggerId: id, status, ...extra, timestamp: new Date().toISOString() });

  // Broadcast to trigger subscribers
  const triggerSet = triggerClients.get(id);
  if (triggerSet) {
    for (const client of triggerSet) {
      try {
        client.write(`event: status\ndata: ${data}\n\n`);
      } catch {
        triggerSet.delete(client);
      }
    }
  }

  // Broadcast to global subscribers
  for (const client of globalClients) {
    try {
      client.write(`event: trigger_status\ndata: ${data}\n\n`);
    } catch {
      globalClients.delete(client);
    }
  }
}
