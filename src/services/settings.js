import { supabase } from "./supabase";

export const settingsService = {
  subscribe: (callback) => {
    supabase.from('settings').select('*').eq('key', 'general').single().then(({ data, error }) => {
      if (!error && data) {
        callback(data.value);
      } else {
        callback({ directApproval: false });
      }
    });

    const channel = supabase
      .channel('public:settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: 'key=eq.general' }, async () => {
        const { data } = await supabase.from('settings').select('*').eq('key', 'general').single();
        if (data) {
          callback(data.value);
        }
      })
      .subscribe();
      
    return () => supabase.removeChannel(channel);
  },

  update: async (updates) => {
    const { data: existing } = await supabase.from('settings').select('value').eq('key', 'general').single();
    
    if (!existing) {
      const { error } = await supabase.from('settings').insert({
        key: 'general',
        value: { directApproval: false, ...updates }
      });
      if (error) throw error;
    } else {
      const { error } = await supabase.from('settings').update({
        value: { ...existing.value, ...updates }
      }).eq('key', 'general');
      if (error) throw error;
    }
  }
};
