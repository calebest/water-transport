import { supabase } from './supabase';

export const personalRecordsService = {
  fetchAll: async (userId) => {
    const { data, error } = await supabase
      .from('personal_records')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  create: async (payload) => {
    const { data, error } = await supabase
      .from('personal_records')
      .insert([payload])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id, payload) => {
    const { data, error } = await supabase
      .from('personal_records')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  delete: async (id) => {
    const { error } = await supabase
      .from('personal_records')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // Look up the auth user_id for a given personnel_id (from the profiles table)
  fetchUserIdByPersonnelId: async (personnelId) => {
    if (!personnelId) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('personnel_id', personnelId)
      .maybeSingle();
    if (error) {
      console.warn('[PersonalRecords] Could not look up profile for personnel:', error.message);
      return null;
    }
    return data?.id || null;
  },

  // Fetch trips where this personnel is either driver or conductor
  fetchLinkedTrips: async (personnelId) => {
    if (!personnelId) return [];
    const { data, error } = await supabase
      .from('trips')
      .select('id, date, location, lorry, trip_number')
      .or(`driver_id.eq.${personnelId},conductor_id.eq.${personnelId}`)
      .order('date', { ascending: false });
    if (error) throw error;
    return data || [];
  }
};
