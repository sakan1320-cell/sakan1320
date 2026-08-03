import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://inpfvfyrfhrgkrhbjrwn.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlucGZ2ZnlyZmhyZ2tyaGJqcnduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODgxNTc5NCwiZXhwIjoyMDk0MzkxNzk0fQ._xedpdqGQeyRpghbvgF640HwMDH3a09Pv3p--sfcfkc';

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  const { data: userData, error: userErr } = await supabase
    .from('profiles')
    .select('id, full_name, email, username')
    .eq('email', 'sakan1320@gmail.com')
    .single();

  if (userErr) {
    console.error('Error fetching profile:', userErr);
    return;
  }

  console.log('Profile data:', userData);

  const { data: roles, error: rolesErr } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', userData.id);

  if (rolesErr) {
    console.error('Error fetching user roles:', rolesErr);
    return;
  }

  console.log('User roles:', roles);
}

run();
