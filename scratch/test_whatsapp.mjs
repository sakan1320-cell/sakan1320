const pluginId = '9f953c30-a51b-4175-854d-e61a40dcbf16';
const phoneNumberId = '121948277663860';
const accessToken = '1fF6YzVPCeMdiIR1mKC6uABJz5eI8pggyESzhcLTIONw6o2gCTFrW1tozIJHa7a6rQPpokmLX7A9PxwjLDhqL2g08iqsyn9XXabeQfIsmhiigMthULL7WGWHONbQgbu2Cw1yzik6xgLm9qWLFwoZpgbOSKhgrp09K2x0nXkpR9WArG3MX6XYOMDJjdN3pxlwU8UOEDDGONFaXHTVO5ptAKISLCjEeEcG0cSnGuLeQVvnbDxHQ01Pbv2y4SMXQQV';
const templateName = 'sakan_test_5';

const runTest = async () => {
  const send = async (label, customPayload) => {
    const url = `https://api.chakrahq.com/v1/ext/plugin/whatsapp/${pluginId}/phoneNumber/966541930995/send-template-message`;
    const payload = {
      whatsappPhoneNumberId: phoneNumberId,
      ...customPayload
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const status = response.status;
      const data = await response.json();
      console.log(`[${label}] Status: ${status}, Response:`, JSON.stringify(data));
    } catch (err) {
      console.error(`[${label}] Error:`, err.message);
    }
  };

  // Test 1: Chakra mapping with user_name
  await send("Chakra mapping named", {
    templateName: templateName,
    mapping: [{ schemaPropertyName: "user_name", schemaPropertyValue: "أحمد" }]
  });

  // Test 2: Meta format with parameter_name
  await send("Meta Format named", {
    templateName: templateName,
    template: {
      name: templateName,
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", parameter_name: "user_name", text: "أحمد" }
          ]
        }
      ]
    }
  });
};

runTest();
