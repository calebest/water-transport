import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const personnelId = 'dummy'; // Doesn't matter, we just want to see if the query fails
  const { data, error } = await supabase
      .from('trips')
      .select('id, date, location, destination, lorry, trip_number')
      .or(`driver_id.eq.${personnelId},conductor_id.eq.${personnelId}`)
      .order('date', { ascending: false })
      .limit(1);

  console.log("Trips fetch Error:", error);
  console.log("Trips Data:", data);

  const { data: recs, error: err2 } = await supabase
      .from('personal_records')
      .select('*')
      .limit(1);
  console.log("Records Error:", err2);
  console.log("Records Data:", recs);
}
check();
