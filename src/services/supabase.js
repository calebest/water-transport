import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL and Anon Key are required! Please set them in your .env.local file.")
}

// 1. Intercept fetch to detect mutations (fallback for missing DB Realtime config)
const originalFetch = window.fetch;
const customFetch = async (url, options) => {
  const response = await originalFetch(url, options);
  if (options && ['POST', 'PATCH', 'DELETE'].includes(options.method)) {
     if (response.ok && url.includes('/rest/v1/')) {
        // Slight delay to ensure DB transaction commits before clients re-fetch
        setTimeout(() => window.dispatchEvent(new Event('db_mutated')), 300);
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

window.addEventListener('db_mutated', () => {
  customListeners.forEach((callbacks) => {
    callbacks.forEach(cb => cb());
  });
});

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
