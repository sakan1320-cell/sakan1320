import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://inpfvfyrfhrgkrhbjrwn.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlucGZ2ZnlyZmhyZ2tyaGJqcnduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODgxNTc5NCwiZXhwIjoyMDk0MzkxNzk0fQ._xedpdqGQeyRpghbvgF640HwMDH3a09Pv3p--sfcfkc';

const supabase = createClient(supabaseUrl, serviceKey);

const run = async () => {
  try {
    // 1. Sign in to get user session JWT
    console.log("Signing in...");
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: 'sakan1320@gmail.com',
      password: 'sakan1320@gmail.com'
    });

    if (authErr) {
      console.error("Auth failed:", authErr);
      return;
    }

    const token = authData.session.access_token;
    console.log("Token obtained successfully.");

    // 2. Invoke Edge Function
    const url = `${supabaseUrl}/functions/v1/send-notification`;
    console.log("Invoking edge function...");
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        template: "manual",
        channel: "whatsapp",
        recipient_phone: "966541930995",
        recipient_name: "Fares Test",
        body: "مرحبا كيف حالك"
      })
    });

    const status = response.status;
    const text = await response.text();
    console.log("Status:", status);
    console.log("Response Body:", text);
  } catch (err) {
    console.error("Test execution failed:", err);
  }
};

run();
