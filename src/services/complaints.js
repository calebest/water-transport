import { supabase } from "./supabase";

const fetchComplaints = async () => {
  const { data, error } = await supabase.from('complaints').select('*').order('created_at', { ascending: false });
  if (error) { console.error("complaints fetch error:", error.message); return []; }
  return (data || []).map(d => ({ ...d, reportedBy: d.reported_by, createdAt: d.created_at }));
};

export const complaintService = {
  add: async (data) => {
    const { data: inserted, error } = await supabase
      .from('complaints')
      .insert({
        date: data.date,
        subject: data.subject,
        description: data.description,
        severity: data.severity || "low",
        status: data.status || "open",
        reported_by: data.reportedBy
      })
      .select()
      .single();
    if (error) throw error;
    return { ...inserted, reportedBy: inserted.reported_by, createdAt: inserted.created_at };
  },

  update: async (id, data) => {
    const { error } = await supabase
      .from('complaints')
      .update({
        date: data.date,
        subject: data.subject,
        description: data.description,
        severity: data.severity,
        status: data.status,
      })
      .eq('id', id);
    if (error) throw error;
  },

  delete: async (id) => {
    const { error } = await supabase.from('complaints').delete().eq('id', id);
    if (error) throw error;
  },

  subscribe: (callback) => {
    const channelId = `complaints-${Math.random().toString(36).slice(2)}`;
    let mounted = true;

    fetchComplaints().then(data => { if (mounted) callback(data); });

    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, async () => {
        const data = await fetchComplaints();
        if (mounted) callback(data);
      })
      .subscribe();
      
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }
};
