import { supabase } from "./supabase";

const fetchMaintenance = async () => {
  const { data, error } = await supabase.from('maintenance').select('*').order('date', { ascending: false });
  if (error) { console.error("maintenance fetch error:", error.message); return []; }
  return data || [];
};

export const maintenanceService = {
  add: async (data) => {
    const { data: inserted, error } = await supabase
      .from('maintenance')
      .insert({
        date: data.date,
        lorry: data.lorry,
        type: data.type,
        description: data.description || "",
        cost: Number(data.cost || 0),
        odometer: data.odometer ? Number(data.odometer) : null,
      })
      .select()
      .single();
    if (error) throw error;
    return inserted;
  },

  update: async (id, data) => {
    const { error } = await supabase
      .from('maintenance')
      .update({
        date: data.date,
        lorry: data.lorry,
        type: data.type,
        description: data.description || "",
        cost: Number(data.cost || 0),
        odometer: data.odometer ? Number(data.odometer) : null,
      })
      .eq('id', id);
    if (error) throw error;
  },

  delete: async (id) => {
    const { error } = await supabase.from('maintenance').delete().eq('id', id);
    if (error) throw error;
  },

  subscribe: (callback) => {
    const channelId = `maintenance-${Math.random().toString(36).slice(2)}`;
    let mounted = true;

    const refresh = async () => {
      const data = await fetchMaintenance();
      if (mounted) callback(data);
    };

    refresh();

    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance' }, refresh)
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
