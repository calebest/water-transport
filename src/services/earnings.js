import { supabase } from "./supabase";

const DEFAULT_CONFIG = {
  ratePerTrip: 200,
  dailyCommissionAmount: 200,
  commissionStatus: "Enabled",
  effectiveDate: "",
  notes: "",
};

export const earningsService = {
  subscribeConfig: (callback) => {
    supabase.from('settings').select('*').eq('key', 'earningsConfig').single().then(({ data, error }) => {
      if (!error && data) {
        callback({ ...DEFAULT_CONFIG, ...data.value });
      } else {
        callback({ ...DEFAULT_CONFIG });
      }
    });

    const channel = supabase
      .channel('public:settings:earningsConfig')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: 'key=eq.earningsConfig' }, async () => {
        const { data } = await supabase.from('settings').select('*').eq('key', 'earningsConfig').single();
        if (data) {
          callback({ ...DEFAULT_CONFIG, ...data.value });
        }
      })
      .subscribe();
      
    return () => supabase.removeChannel(channel);
  },

  updateConfig: async (updates) => {
    const { data: existing } = await supabase.from('settings').select('value').eq('key', 'earningsConfig').single();
    const nextAmount = Number(updates.dailyCommissionAmount ?? updates.ratePerTrip ?? DEFAULT_CONFIG.dailyCommissionAmount);

    const payload = {
      dailyCommissionAmount: nextAmount,
      ratePerTrip: nextAmount,
      commissionStatus: updates.commissionStatus || DEFAULT_CONFIG.commissionStatus,
      effectiveDate: updates.effectiveDate || "",
      notes: updates.notes || "",
      updatedAt: new Date().toISOString(),
    };

    if (!existing) {
      const { error } = await supabase.from('settings').insert({
        key: 'earningsConfig',
        value: payload
      });
      if (error) throw error;
    } else {
      const { error } = await supabase.from('settings').update({
        value: payload
      }).eq('key', 'earningsConfig');
      if (error) throw error;
    }
  },
};
