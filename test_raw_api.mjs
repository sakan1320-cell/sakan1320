import fetch from 'node-fetch';

const run = async () => {
  const metaTemplate = {
    name: "group_invite_link_concise",
    language: { code: "ar" },
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: "الخدمة التجريبية المباشرة" },
          { type: "text", text: "استشارة ABC" },
          { type: "text", text: "Y2FwaV9ncm91cDoxOTUwNTU1MDA3OToxMjAzNjMyNDQwODgyNzY1NDYZD" }
        ]
      }
    ]
  };

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: "966541930995",
    type: "template",
    template: metaTemplate
  };

  console.log("Sending payload:", JSON.stringify(payload, null, 2));

  const url = `https://api.chakrahq.com/v1/ext/plugin/whatsapp/9f953c30-a51b-4175-854d-e61a40dcbf16/api/v21.0/121948277663860/messages`;
  const accessToken = '1fF6YzVPCeMdiIR1mKC6uABJz5eI8pggyESzhcLTIONw6o2gCTFrW1tozIJHa7a6rQPpokmLX7A9PxwjLDhqL2g08iqsyn9XXabeQfIsmhiigMthULL7WGWHONbQgbu2Cw1yzik6xgLm9qWLFwoZpgbOSKhgrp09K2x0nXkpR9WArG3MX6XYOMDJjdN3pxlwU8UOEDDGONFaXHTVO5ptAKISLCjEeEcG0cSnGuLeQVvnbDxHQ01Pbv2y4SMXQQV';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  let data = await res.json();
  console.log('ar', res.status, data);
};

run();
