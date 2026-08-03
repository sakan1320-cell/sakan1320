import i18n from "i18next";

export const getDisplayName = (profile: any, fallback: string = "") => {
  if (!profile) return fallback;
  
  const lang = i18n.language || 'ar';
  
  if (lang === 'ar' && profile.display_name_ar) return profile.display_name_ar;
  if (lang === 'en' && profile.display_name_en) return profile.display_name_en;
  
  return profile.full_name || profile.username || fallback || profile.email?.split('@')[0] || "";
};
