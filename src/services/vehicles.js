import { supabase } from "./supabase";

const fetchVehicles = async () => {
  const { data, error } = await supabase.from('vehicles').select('*').order('plate');
  if (error) { console.error("vehicles fetch error:", error.message); return []; }
  return (data || []).map(d => ({ ...d, name: d.type, notes: d.capacity }));
};

export const vehicleService = {
  add: async (data) => {
    const { data: inserted, error } = await supabase
      .from('vehicles')
      .insert({
        plate: data.plate,
        type: data.name,
        capacity: data.notes || "",
        status: data.status || "Active",
      })
      .select()
      .single();
    if (error) throw error;
    return inserted;
  },

  update: async (id, data) => {
    const { error } = await supabase
      .from('vehicles')
      .update({
        plate: data.plate,
        type: data.name,
        capacity: data.notes || "",
        status: data.status || "Active",
      })
      .eq('id', id);
    if (error) throw error;
  },

  delete: async (id) => {
    const { error } = await supabase.from('vehicles').delete().eq('id', id);
    if (error) throw error;
  },

  subscribe: (callback) => {
    const channelId = `vehicles-${Math.random().toString(36).slice(2)}`;
    let mounted = true;

    const refresh = async () => {
      const data = await fetchVehicles();
      if (mounted) callback(data);
    };

    refresh();

    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, refresh)
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
