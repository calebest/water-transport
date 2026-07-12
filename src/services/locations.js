import { supabase } from "./supabase";

const refreshLocations = (callback, data) => {
  if (typeof callback === 'function') callback(data);
};

const fetchLocations = async () => {
  const { data, error } = await supabase.from('locations').select('*').order('name');
  if (error) { console.error("locations fetch error:", error.message); return []; }
  return (data || []).map(d => ({ ...d, revenue: d.default_rate }));
};

export const locationService = {
  add: async (data) => {
    const { data: inserted, error } = await supabase
      .from('locations')
      .insert({
        name: data.name,
        default_rate: Number(data.revenue) || 0,
      })
      .select()
      .single();
    if (error) throw error;
    return inserted;
  },

  update: async (id, data) => {
    const { error } = await supabase
      .from('locations')
      .update({
        name: data.name,
        default_rate: Number(data.revenue) || 0,
      })
      .eq('id', id);
    if (error) throw error;
  },

  delete: async (id) => {
    const { error } = await supabase.from('locations').delete().eq('id', id);
    if (error) throw error;
  },

  subscribe: (callback) => {
    const channelId = `locations-${Math.random().toString(36).slice(2)}`;
    let mounted = true;

    const refresh = async () => {
      const data = await fetchLocations();
      if (mounted) refreshLocations(callback, data);
    };

    refresh();

    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, refresh)
      .subscribe();

    const handleMutation = () => {
      refresh();
    };

    window.addEventListener('db_mutated', handleMutation);

    return () => {
      mounted = false;
      window.removeEventListener('db_mutated', handleMutation);
      supabase.removeChannel(channel);
    };
  }
};
