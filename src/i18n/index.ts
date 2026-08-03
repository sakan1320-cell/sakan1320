import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import ar from "./locales/ar";
import en from "./locales/en";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { ar: { translation: ar }, en: { translation: en } },
    fallbackLng: "ar",
    lng: typeof window !== "undefined" ? (localStorage.getItem("lang") || "ar") : "ar",
    supportedLngs: ["ar", "en"],
    detection: {
      order: ["localStorage"],
      caches: ["localStorage"],
      lookupLocalStorage: "lang",
    },
    interpolation: { escapeValue: false },
  });

if (typeof window !== "undefined" && !localStorage.getItem("lang")) {
  localStorage.setItem("lang", "ar");
  i18n.changeLanguage("ar");
}

const applyDir = (lng: string) => {
  const dir = lng === "ar" ? "rtl" : "ltr";
  document.documentElement.setAttribute("dir", dir);
  document.documentElement.setAttribute("lang", lng);
};

applyDir(i18n.language || "ar");
i18n.on("languageChanged", applyDir);

export default i18n;
