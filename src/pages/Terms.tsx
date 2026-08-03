import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Terms = () => {
  const [lang, setLang] = useState<"ar" | "en">("ar");

  useEffect(() => {
    document.title = "Terms of Service | شروط الخدمة - Sakansa";
    const desc = "Terms of Service for Sakansa — rules for using the platform and WhatsApp notifications.";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", desc);
    else {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = desc;
      document.head.appendChild(m);
    }
  }, []);

  const isAr = lang === "ar";

  return (
    <div dir={isAr ? "rtl" : "ltr"} className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to="/" className="font-bold">Sakansa</Link>
          <div className="flex gap-2">
            <Button size="sm" variant={isAr ? "default" : "outline"} onClick={() => setLang("ar")}>العربية</Button>
            <Button size="sm" variant={!isAr ? "default" : "outline"} onClick={() => setLang("en")}>English</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {isAr ? (
          <article className="max-w-none space-y-4">
            <h1 className="text-3xl font-bold">شروط الخدمة</h1>
            <p className="text-sm text-muted-foreground">آخر تحديث: 4 مايو 2026</p>
            <p>باستخدام منصة <strong>Sakansa</strong> فإنك توافق على هذه الشروط التي تنظّم استخدام الخدمات الرقمية والرسائل التشغيلية.</p>
            <h2 className="mt-6 text-xl font-semibold">1. استخدام المنصة</h2>
            <p>يجب استخدام المنصة للأغراض الإدارية والتشغيلية المشروعة فقط، وبما يتوافق مع الأنظمة المعمول بها.</p>
            <h2 className="mt-6 text-xl font-semibold">2. الحسابات والصلاحيات</h2>
            <p>يتحمل المستخدم مسؤولية الحفاظ على سرية بيانات الدخول وعدم مشاركة الحساب أو الصلاحيات مع غير المخوّلين.</p>
            <h2 className="mt-6 text-xl font-semibold">3. الرسائل</h2>
            <p>قد ترسل المنصة رسائل تشغيلية عبر واتساب أو SMS أو البريد الإلكتروني للأرقام والبيانات المقدمة طوعًا، ويمكن طلب إيقافها في أي وقت.</p>
            <h2 className="mt-6 text-xl font-semibold">4. حدود المسؤولية</h2>
            <p>نبذل جهدنا للحفاظ على توفر الخدمة ودقتها، ولا نضمن خلوها من الانقطاعات أو الأخطاء الخارجة عن السيطرة.</p>
            <h2 className="mt-6 text-xl font-semibold">5. التواصل</h2>
            <p>للاستفسارات: <a className="text-primary underline" href="mailto:sakan1320@gmail.com">sakan1320@gmail.com</a></p>
          </article>
        ) : (
          <article className="max-w-none space-y-4">
            <h1 className="text-3xl font-bold">Terms of Service</h1>
            <p className="text-sm text-muted-foreground">Last updated: May 4, 2026</p>
            <p>By using <strong>Sakansa</strong>, you agree to these terms governing use of the platform and operational notifications.</p>
            <h2 className="mt-6 text-xl font-semibold">1. Platform Use</h2>
            <p>The platform must be used only for legitimate administrative and operational purposes in compliance with applicable laws.</p>
            <h2 className="mt-6 text-xl font-semibold">2. Accounts and Permissions</h2>
            <p>Users are responsible for keeping login credentials confidential and not sharing access with unauthorized persons.</p>
            <h2 className="mt-6 text-xl font-semibold">3. Notifications</h2>
            <p>The platform may send operational notifications via WhatsApp, SMS, or email to voluntarily provided contact details. Users may opt out at any time.</p>
            <h2 className="mt-6 text-xl font-semibold">4. Limitation of Liability</h2>
            <p>We work to keep the service available and accurate, but we do not guarantee uninterrupted or error-free operation.</p>
            <h2 className="mt-6 text-xl font-semibold">5. Contact</h2>
            <p>For inquiries: <a className="text-primary underline" href="mailto:sakan1320@gmail.com">sakan1320@gmail.com</a></p>
          </article>
        )}
      </main>
    </div>
  );
};

export default Terms;