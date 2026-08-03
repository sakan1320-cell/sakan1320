const { createClient } = require('@supabase/supabase-js');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLogs() {
  console.log("Fetching recent notifications...");
  const { data, error } = await supabase
    .from('notifications')
    .select('id, template, recipient_phone, status, error, created_at, provider_message_id')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error("DB Error:", error);
    return;
  }

  console.log(JSON.stringify(data, null, 2));
}

checkLogs();
