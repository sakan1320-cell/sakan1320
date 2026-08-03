const pluginId = '9f953c30-a51b-4175-854d-e61a40dcbf16';
const phoneNumberId = '121948277663860';
const accessToken = '1fF6YzVPCeMdiIR1mKC6uABJz5eI8pggyESzhcLTIONw6o2gCTFrW1tozIJHa7a6rQPpokmLX7A9PxwjLDhqL2g08iqsyn9XXabeQfIsmhiigMthULL7WGWHONbQgbu2Cw1yzik6xgLm9qWLFwoZpgbOSKhgrp09K2x0nXkpR9WArG3MX6XYOMDJjdN3pxlwU8UOEDDGONFaXHTVO5ptAKISLCjEeEcG0cSnGuLeQVvnbDxHQ01Pbv2y4SMXQQV';
const phone = '966541930995';

const run = async () => {
  // ChakraHQ pass-through URL
  const url = `https://api.chakrahq.com/v1/ext/plugin/whatsapp/${pluginId}/api/v21.0/${phoneNumberId}/messages`;

  console.log("Sending pass-through request to:", url);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phone,
        type: "text",
        text: { preview_url: false, body: "مرحبا كيف حالك" }
      })
    });

    const status = response.status;
    const data = await response.json();
    console.log("Status:", status);
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Failed:", err);
  }
};

run();
