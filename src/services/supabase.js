import { createClient } from '@supabase/supabase-js'

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' ? process.env : {});
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL and Anon Key are required! Please set them in your .env.local file.")
}

export const notifyDbMutated = (tableName = null, method = null) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('db_mutated', {
    detail: { table: tableName, method },
  }));
};

// 1. Intercept fetch to detect mutations (fallback for missing DB Realtime config)
const originalFetch = typeof window !== 'undefined' ? window.fetch : globalThis.fetch;
const customFetch = async (url, options) => {
  const response = await originalFetch(url, options);
  const method = options?.method?.toUpperCase?.();

  if (response.ok && method && ['POST', 'PATCH', 'DELETE'].includes(method) && typeof url === 'string' && url.includes('/rest/v1/')) {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
      const parsedUrl = new URL(url, origin);
      const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
      const tableName = pathSegments[2] || null;

      // Slight delay to ensure DB transaction commits before clients re-fetch
      setTimeout(() => notifyDbMutated(tableName, method), 300);
    } catch {
      setTimeout(() => notifyDbMutated(null, method), 300);
    }
  }
  return response;
};

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder', {
  global: { fetch: customFetch }
})

// 2. Proxy channel subscriptions to also listen to our local fake event
const originalChannel = supabase.channel.bind(supabase);
const originalRemoveChannel = supabase.removeChannel.bind(supabase);

const customListeners = new Map();

if (typeof window !== 'undefined') {
  window.addEventListener('db_mutated', () => {
    customListeners.forEach((callbacks) => {
      callbacks.forEach(cb => cb());
    });
  });
}

supabase.channel = (name, opts) => {
  const chan = originalChannel(name, opts);
  const originalOn = chan.on.bind(chan);

  chan.on = (type, filter, callback) => {
    if (type === 'postgres_changes') {
      if (!customListeners.has(chan)) customListeners.set(chan, []);
      customListeners.get(chan).push(callback);
    }
    return originalOn(type, filter, callback);
  };

  return chan;
};

supabase.removeChannel = (chan) => {
  customListeners.delete(chan);
  return originalRemoveChannel(chan);
};
