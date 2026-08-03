import { useState, useEffect } from 'react';

export interface WhatsAppSettings {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  pluginId: string;
  phoneNumberId: string;
}

const defaultSettings: WhatsAppSettings = {
  clientId: import.meta.env.VITE_CHAKRAHQ_CLIENT_ID || '4c3e58844983d8848e0af3435aef4af3',
  clientSecret: import.meta.env.VITE_CHAKRAHQ_CLIENT_SECRET || 'c1b800aa68bcb26525acc5afaa94aca6205d2d81889f9ffc60a68c7fcae203ae',
  accessToken: import.meta.env.VITE_CHAKRAHQ_ACCESS_TOKEN || '1fF6YzVPCeMdiIR1mKC6uABJz5eI8pggyESzhcLTIONw6o2gCTFrW1tozIJHa7a6rQPpokmLX7A9PxwjLDhqL2g08iqsyn9XXabeQfIsmhiigMthULL7WGWHONbQgbu2Cw1yzik6xgLm9qWLFwoZpgbOSKhgrp09K2x0nXkpR9WArG3MX6XYOMDJjdN3pxlwU8UOEDDGONFaXHTVO5ptAKISLCjEeEcG0cSnGuLeQVvnbDxHQ01Pbv2y4SMXQQV',
  refreshToken: import.meta.env.VITE_CHAKRAHQ_REFRESH_TOKEN || 'Mlr7WwqpAmHyj4xGHRgga2oNW8rKMjIHE3jEEg2gdLuDy6xHdZnT4ZopG18OWwTub8jbqHAngnxhdhoXzeoQgfmbnMwgp17mkdsVeXFg1M4b6sm5JjcfnH5geaCuKAB2guibdjA1Xeb1L1TrGTcwGy2uQ03qfDtxKJYfUQ5cMA24gFiieMtTBCs9GGWcgwQUwpsM5TLFUxUwErwYUYMAtU2AApQGOlWcaNgUgIEQZEYi9DGHJuDXXdpe5Gv6kQc',
  pluginId: import.meta.env.VITE_CHAKRAHQ_PLUGIN_ID || '9f953c30-a51b-4175-854d-e61a40dcbf16',
  phoneNumberId: import.meta.env.VITE_CHAKRAHQ_PHONE_NUMBER_ID || '121948277663860',
};

export function useWhatsAppSettings() {
  const [settings, setSettings] = useState<WhatsAppSettings>(() => {
    const stored = localStorage.getItem('whatsapp_settings_v2');
    let initial = defaultSettings;
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        initial = { ...defaultSettings, ...parsed };
        // Fallback for empty strings
        if (!initial.clientId) initial.clientId = defaultSettings.clientId;
        if (!initial.clientSecret) initial.clientSecret = defaultSettings.clientSecret;
        if (!initial.accessToken) initial.accessToken = defaultSettings.accessToken;
        if (!initial.pluginId) initial.pluginId = defaultSettings.pluginId;
        if (!initial.phoneNumberId) initial.phoneNumberId = defaultSettings.phoneNumberId;
      } catch (e) {
        // Ignore
      }
    }
    return initial;
  });

  const saveSettings = (newSettings: Partial<WhatsAppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem('whatsapp_settings_v2', JSON.stringify(updated));
    
    // Dispatch a custom event so other components know settings changed
    const event = new CustomEvent('whatsapp-settings-updated', { detail: updated });
    window.dispatchEvent(event);
  };

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'whatsapp_settings_v2' && e.newValue) {
        try {
          setSettings(JSON.parse(e.newValue));
        } catch (err) {
          // Ignore
        }
      }
    };
    
    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<WhatsAppSettings>;
      setSettings(customEvent.detail);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('whatsapp-settings-updated', handleCustomEvent);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('whatsapp-settings-updated', handleCustomEvent);
    };
  }, []);

  return { settings, saveSettings };
}
