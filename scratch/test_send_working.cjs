const fetch = require('node-fetch');
const payload = {
  template: 'reminder',
  channel: 'whatsapp',
  recipient_phone: '+966541930995',
  body: 'اختبار رسالة إلى رقم يعمل',
};

(async () => {
  try {
    const res = await fetch('https://inpfvfyrfhrgkrhbjrwn.supabase.co/functions/v1/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Response:', data);
  } catch (e) {
    console.error('Error:', e);
  }
})();
