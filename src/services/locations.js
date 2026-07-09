import { supabase } from "./supabase";

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

    fetchLocations().then(data => { if (mounted) callback(data); });

    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, async () => {
        const data = await fetchLocations();
        if (mounted) callback(data);
      })
      .subscribe();
      
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }
};
