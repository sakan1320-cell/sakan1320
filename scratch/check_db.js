module.paths.push('c:/Users/faarr/OneDrive/Documents/sakansa/node_modules');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Users/faarr/OneDrive/Documents/sakansa/.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: cols, error } = await supabase.rpc('exec_sql', {
    sql_query: `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'enjaz_groups';
    `
  });
  if (error) {
    console.error('Error fetching columns:', error);
    // Let's try direct query if rpc doesn't exist
    const { data: testData, error: testErr } = await supabase.from('enjaz_groups').select('*').limit(1);
    if (testErr) {
      console.error('Error selecting from enjaz_groups:', testErr);
    } else {
      console.log('Sample record keys:', testData.length > 0 ? Object.keys(testData[0]) : 'No records');
    }
  } else {
    console.log('Columns in public.enjaz_groups:');
    cols.forEach(c => console.log(`- ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable})`));
  }
}

run();
