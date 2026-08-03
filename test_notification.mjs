import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://inpfvfyrfhrgkrhbjrwn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlucGZ2ZnlyZmhyZ2tyaGJqcnduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MTU3OTQsImV4cCI6MjA5NDM5MTc5NH0._L5vOQ0tJDlBJrFKbQJpgsUeiS4fmIU_IQiblO82sPY';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlucGZ2ZnlyZmhyZ2tyaGJqcnduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODgxNTc5NCwiZXhwIjoyMDk0MzkxNzk0fQ._xedpdqGQeyRpghbvgF640HwMDH3a09Pv3p--sfcfkc';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const run = async () => {
  console.log("إرسال رسالة تجريبية...");
  
  const payload = {
    template: 'late_alert',
    channel: 'whatsapp',
    recipient_phone: '966541930995', // Country code for Saudi Arabia added automatically
    variables: {
      guardian_name: "مدير النظام",
      participant_name: "مشارك تجريبي",
      project_name: "نادي رقي",
      date: new Date().toISOString().split('T')[0]
    }
  };

  const { data, error } = await supabase.functions.invoke('send-notification', {
    body: payload
  });

  if (error) {
    console.error("❌ فشل الإرسال:", error);
  } else {
    console.log("✅ تم الإرسال بنجاح:", data);
  }
};

run();
