import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Privacy = () => {
  const [lang, setLang] = useState<"ar" | "en">("ar");

  useEffect(() => {
    document.title = "Privacy Policy | سياسة الخصوصية - Sakansa";
    const meta = document.querySelector('meta[name="description"]');
    const desc = "Privacy Policy for Sakansa — how we collect, use, and protect personal data, including WhatsApp notifications.";
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
          <article className="prose prose-slate max-w-none space-y-4">
            <h1 className="text-3xl font-bold">سياسة الخصوصية</h1>
            <p className="text-sm text-muted-foreground">آخر تحديث: 4 مايو 2026</p>

            <p>
              تحترم منصة <strong>Sakansa</strong> ("نحن"، "لدينا"، "المنصة") خصوصية مستخدميها. توضح هذه السياسة كيف نجمع المعلومات
              ونستخدمها ونحميها عند استخدامك لخدماتنا، بما في ذلك رسائل واتساب (WhatsApp Business API من Meta).
            </p>

            <h2 className="text-xl font-semibold mt-6">1. المعلومات التي نجمعها</h2>
            <ul className="list-disc ms-6 space-y-1">
              <li>الاسم الكامل والبريد الإلكتروني ورقم الهاتف.</li>
              <li>بيانات المشاركين وأولياء الأمور (الاسم، رقم الجوال، الحضور والغياب).</li>
              <li>سجلات الرسائل المُرسلة (نص الرسالة، التاريخ، الحالة).</li>
              <li>بيانات تقنية: عنوان IP، نوع المتصفح، سجلات الدخول.</li>
            </ul>

            <h2 className="text-xl font-semibold mt-6">2. كيف نستخدم المعلومات</h2>
            <ul className="list-disc ms-6 space-y-1">
              <li>إدارة حسابات الموظفين والمشاركين والمشاريع التدريبية.</li>
              <li>إرسال رسائل تشغيلية (حضور، غياب، تذكيرات) عبر واتساب أو SMS أو البريد الإلكتروني.</li>
              <li>تحسين جودة الخدمة وإعداد التقارير الإدارية.</li>
              <li>الامتثال للالتزامات القانونية والنظامية.</li>
            </ul>

            <h2 className="text-xl font-semibold mt-6">3. رسائل واتساب (WhatsApp)</h2>
            <p>
              نستخدم WhatsApp Business API الرسمي من Meta لإرسال الرسائل للمستخدمين الذين قدّموا أرقامهم طوعًا. لا نشارك أرقام الهاتف
              مع أي طرف ثالث لأغراض تسويقية. يمكن للمستخدم إيقاف استقبال الرسائل في أي وقت بإرسال كلمة "إيقاف" أو "STOP".
            </p>

            <h2 className="text-xl font-semibold mt-6">4. مشاركة البيانات</h2>
            <p>
              لا نبيع بياناتك. قد نشاركها فقط مع: مزوّدي البنية التحتية (مثل Supabase وMeta) لتشغيل الخدمة، أو الجهات الحكومية عند الطلب
              القانوني.
            </p>

            <h2 className="text-xl font-semibold mt-6">5. حماية البيانات</h2>
            <p>
              نستخدم تشفير HTTPS، وسياسات Row-Level Security على قاعدة البيانات، ومصادقة آمنة للحسابات. نحتفظ بالبيانات طوال مدة استخدام
              الحساب، ويمكن حذفها بناءً على طلبك.
            </p>

            <h2 className="text-xl font-semibold mt-6">6. حقوقك</h2>
            <ul className="list-disc ms-6 space-y-1">
              <li>الوصول إلى بياناتك وتعديلها أو حذفها.</li>
              <li>سحب الموافقة على استقبال الرسائل.</li>
              <li>تقديم شكوى للجهة المختصة بحماية البيانات في بلدك.</li>
            </ul>

            <h2 className="text-xl font-semibold mt-6">7. التواصل</h2>
            <p>
              لأي استفسار عن الخصوصية، تواصل معنا عبر البريد:{" "}
              <a className="text-primary underline" href="mailto:privacy@sakansa.com">privacy@sakansa.com</a>
            </p>
          </article>
        ) : (
          <article className="prose prose-slate max-w-none space-y-4">
            <h1 className="text-3xl font-bold">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground">Last updated: May 4, 2026</p>

            <p>
              <strong>Sakansa</strong> ("we", "us", "the Platform") respects user privacy. This policy explains how we collect, use, and
              protect personal data when you use our services, including WhatsApp notifications via Meta's WhatsApp Business API.
            </p>

            <h2 className="text-xl font-semibold mt-6">1. Information We Collect</h2>
            <ul className="list-disc ms-6 space-y-1">
              <li>Full name, email address, and phone number.</li>
              <li>Participant and guardian information (name, phone, attendance).</li>
              <li>Notification logs (message content, timestamp, delivery status).</li>
              <li>Technical data: IP address, browser type, login records.</li>
            </ul>

            <h2 className="text-xl font-semibold mt-6">2. How We Use Information</h2>
            <ul className="list-disc ms-6 space-y-1">
              <li>Manage staff, participant, and training project accounts.</li>
              <li>Send operational notifications (attendance, absence, reminders) via WhatsApp, SMS, or email.</li>
              <li>Improve service quality and produce administrative reports.</li>
              <li>Comply with legal and regulatory obligations.</li>
            </ul>

            <h2 className="text-xl font-semibold mt-6">3. WhatsApp Notifications</h2>
            <p>
              We use Meta's official WhatsApp Business API to send notifications to users who have voluntarily provided their phone
              numbers. We do not share phone numbers with any third party for marketing. Users may opt out at any time by replying
              "STOP".
            </p>

            <h2 className="text-xl font-semibold mt-6">4. Data Sharing</h2>
            <p>
              We do not sell your data. We only share it with: infrastructure providers (such as Supabase and Meta) to operate the
              service, or government authorities upon lawful request.
            </p>

            <h2 className="text-xl font-semibold mt-6">5. Data Protection</h2>
            <p>
              We use HTTPS encryption, database Row-Level Security policies, and secure account authentication. Data is retained for
              the duration of account use and may be deleted upon request.
            </p>

            <h2 className="text-xl font-semibold mt-6">6. Your Rights</h2>
            <ul className="list-disc ms-6 space-y-1">
              <li>Access, correct, or delete your data.</li>
              <li>Withdraw consent for receiving notifications.</li>
              <li>File a complaint with your local data protection authority.</li>
            </ul>

            <h2 className="text-xl font-semibold mt-6">7. Contact</h2>
            <p>
              For privacy inquiries, contact us at:{" "}
              <a className="text-primary underline" href="mailto:privacy@sakansa.com">privacy@sakansa.com</a>
            </p>
          </article>
        )}
      </main>

      <footer className="border-t mt-8">
        <div className="mx-auto max-w-3xl px-4 py-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Sakansa. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Privacy;
