import { supabase } from "./supabase";

const fetchPersonnel = async () => {
  const { data, error } = await supabase.from('personnel').select('*').order('name');
  if (error) { console.error("personnel fetch error:", error.message); return []; }
  return (data || []).map(d => ({ ...d, idNumber: d.id_number }));
};

export const personnelService = {
  add: async (data) => {
    const { data: inserted, error } = await supabase
      .from('personnel')
      .insert({
        name: data.name,
        role: data.role,
        phone: data.phone || "",
        id_number: data.idNumber || "",
        status: data.status || "Active",
        notes: data.notes || "",
      })
      .select()
      .single();
    if (error) throw error;
    return { ...inserted, idNumber: inserted.id_number };
  },
  
  update: async (id, data) => {
    const { error } = await supabase
      .from('personnel')
      .update({
        name: data.name,
        role: data.role,
        phone: data.phone || "",
        id_number: data.idNumber || "",
        status: data.status || "Active",
        notes: data.notes || ""
      })
      .eq('id', id);
    if (error) throw error;
  },

  delete: async (id) => {
    // Step 1: Null out driver references in trips
    await supabase.from('trips').update({ driver_id: null }).eq('driver_id', id);
    // Step 2: Null out conductor references in trips
    await supabase.from('trips').update({ conductor_id: null }).eq('conductor_id', id);
    // Step 3: Delete their ledger entries
    await supabase.from('personnel_ledger').delete().eq('personnel_id', id);
    // Step 4: Delete any loans linked to them
    await supabase.from('loans').delete().eq('personnel_id', id);
    // Step 5: Now safe to delete the personnel record
    const { error } = await supabase.from('personnel').delete().eq('id', id);
    if (error) throw error;
  },

  subscribe: (callback) => {
    const channelId = `personnel-${Math.random().toString(36).slice(2)}`;
    let mounted = true;

    fetchPersonnel().then(data => { if (mounted) callback(data); });

    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'personnel' }, async () => {
        const data = await fetchPersonnel();
        if (mounted) callback(data);
      })
      .subscribe();
      
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }
};
