import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const DataDeletion = () => {
  const [lang, setLang] = useState<"ar" | "en">("ar");

  useEffect(() => {
    document.title = "Data Deletion | حذف بيانات المستخدم - Sakansa";
    const desc = "Instructions for requesting deletion of personal data from Sakansa.";
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
            <h1 className="text-3xl font-bold">تعليمات حذف بيانات المستخدم</h1>
            <p className="text-sm text-muted-foreground">آخر تحديث: 4 مايو 2026</p>
            <p>يمكنك طلب حذف بياناتك الشخصية المخزنة في منصة <strong>Sakansa</strong> في أي وقت.</p>
            <h2 className="mt-6 text-xl font-semibold">طريقة طلب الحذف</h2>
            <ol className="list-decimal space-y-2 ps-6">
              <li>أرسل بريدًا إلكترونيًا إلى <a className="text-primary underline" href="mailto:sakan1320@gmail.com">sakan1320@gmail.com</a>.</li>
              <li>اكتب في عنوان الرسالة: طلب حذف البيانات.</li>
              <li>اذكر الاسم ورقم الجوال أو البريد المرتبط بالحساب.</li>
            </ol>
            <h2 className="mt-6 text-xl font-semibold">ماذا يتم حذفه؟</h2>
            <p>سنحذف البيانات الشخصية المرتبطة بحسابك أو رقمك، بما في ذلك بيانات التواصل وسجلات الرسائل، ما لم يكن الاحتفاظ بها مطلوبًا نظاميًا.</p>
            <h2 className="mt-6 text-xl font-semibold">مدة المعالجة</h2>
            <p>تتم مراجعة الطلبات عادة خلال 30 يومًا من استلام الطلب المكتمل.</p>
          </article>
        ) : (
          <article className="max-w-none space-y-4">
            <h1 className="text-3xl font-bold">User Data Deletion Instructions</h1>
            <p className="text-sm text-muted-foreground">Last updated: May 4, 2026</p>
            <p>You may request deletion of your personal data stored by <strong>Sakansa</strong> at any time.</p>
            <h2 className="mt-6 text-xl font-semibold">How to Request Deletion</h2>
            <ol className="list-decimal space-y-2 ps-6">
              <li>Email <a className="text-primary underline" href="mailto:sakan1320@gmail.com">sakan1320@gmail.com</a>.</li>
              <li>Use the subject line: Data Deletion Request.</li>
              <li>Include the name, phone number, or email address associated with the account.</li>
            </ol>
            <h2 className="mt-6 text-xl font-semibold">What Will Be Deleted?</h2>
            <p>We will delete personal data associated with your account or phone number, including contact details and notification logs, unless retention is legally required.</p>
            <h2 className="mt-6 text-xl font-semibold">Processing Time</h2>
            <p>Requests are typically reviewed within 30 days after receiving a complete request.</p>
          </article>
        )}
      </main>
    </div>
  );
};

export default DataDeletion;