import { supabase } from "./supabase";

export const brokerService = {
  async getBrokers() {
    const { data, error } = await supabase
      .from('brokers')
      .select('*')
      .order('name');
    if (error) throw error;
    return data || [];
  },

  subscribeBrokers(callback) {
    const subscription = supabase
      .channel('public:brokers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'brokers' }, () => {
        this.getBrokers().then(callback);
      })
      .subscribe();

    this.getBrokers().then(callback);

    return () => {
      supabase.removeChannel(subscription);
    };
  },

  async addBroker(brokerData) {
    const { data, error } = await supabase
      .from('brokers')
      .insert([brokerData])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateBroker(id, updates) {
    const { data, error } = await supabase
      .from('brokers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteBroker(id) {
    const { error } = await supabase
      .from('brokers')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};
