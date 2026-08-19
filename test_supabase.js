import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function testFetch() {
  const personnelId = 'some-dummy-id';
  
  const { data, error } = await supabase
    .from('trips')
    .select('id, date, location, lorry, trip_number')
    .or(`driver_id.eq.${personnelId},conductor_id.eq.${personnelId}`)
    .order('date', { ascending: false });

  console.log("Trips fetch Error:", error);
  
  const { data: records, error: err2 } = await supabase
      .from('personal_records')
      .select('*')
      .eq('user_id', '7a80de08-34fe-46cb-aaf0-ae6094860f13')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
      
  console.log("Records Error:", err2);
  console.log("Records Count:", records ? records.length : 0);
}

testFetch();
