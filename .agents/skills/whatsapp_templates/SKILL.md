---
name: whatsapp_templates
description: >
  دليل إضافة قوالب واتساب جديدة إلى منصة سكن. يُستخدم هذا الدليل عند طلب
  إضافة قالب واتساب جديد أو تعديل قالب موجود أو ربطه بأتمتة في النظام.
---

# دليل إضافة قوالب واتساب في منصة سكن

## نظرة عامة على البنية

```
ChakraHQ (قوالب معتمدة من Meta)
    ↓
notification_templates (جدول قاعدة البيانات)
    ↓
send-notification (Edge Function - Supabase)
    ↓
WhatsApp API → العميل
```

## الخطوات الكاملة لإضافة قالب جديد

### الخطوة 1: إنشاء القالب في ChakraHQ
1. اذهب إلى حساب ChakraHQ → Templates → Create Template
2. **مهم:** استخدم متغيرات رقمية `{{1}}`, `{{2}}`, `{{3}}` (ليس بالأسماء)
3. اختر اللغة `ar` (عربي)
4. انتظر الموافقة (APPROVED) قبل استخدامه

### الخطوة 2: إضافة القالب للنظام (من الواجهة)
1. اذهب إلى **مركز الواتساب → قوالب واتساب**
2. اضغط **"+ إضافة قالب جديد"**
3. أدخل:
   - **المفتاح (key):** يجب أن يطابق تماماً اسم القالب في ChakraHQ
   - **الاسم العربي:** الاسم الذي يظهر في قائمة الإرسال
   - **المتغيرات:** ترتيب المتغيرات من `{{1}}` إلى `{{n}}`
4. في حقل Body، أدخل أسماء المتغيرات بالترتيب: `1, 2, 3`

### الخطوة 3: ربط القالب بأتمتة (اختياري)
1. اذهب إلى **مركز الواتساب → الرسائل التلقائية**
2. اضغط **"+ إضافة حدث تلقائي"**
3. اختر الحدث (غياب، تأخر، قبول تسجيل...)
4. اختر القالب المراد ربطه
5. فعّل التبديل (Switch)

## قواعد مهمة

- **المفتاح يجب أن يطابق تماماً اسم القالب في ChakraHQ** (حساس لحالة الأحرف)
- **ترتيب المتغيرات مهم جداً** — `{{1}}` في الرسالة = أول متغير في القائمة
- **لا تستخدم أسماء عربية للمتغيرات في ChakraHQ** — فقط أرقام
- **انتظر الموافقة (APPROVED)** قبل إضافة القالب للنظام

## قاموس القوالب الحالية

| المفتاح | المتغيرات بالترتيب | الوصف |
|---------|-------------------|--------|
| `late_alert` | 1=guardian_name, 2=participant_name, 3=date, 4=project_name | إشعار تأخر |
| `absence_alert` | 1=guardian_name, 2=participant_name, 3=date, 4=project_name | إشعار غياب |
| `project_launch_notification` | 1=participant_name, 2=project_name, 3=date, 4=time | إطلاق مشروع |
| `group_invitation` | 1=participant_name, 2=project_name, 3=group_link | دعوة مجموعة |
| `group_invite_link_concise` | 1=الخدمة, 2=الاستشارة, 3=الرابط | دعوة مختصرة |
| `attendance_absence_notice` | 1=guardian_name, 2=participant_name, 3=project_name, 4=date | إشعار حضور رسمي |
| `closing_ceremony_invitation` | 1=project_name, 2=date, 3=time | دعوة حفل ختامي |
| `participant_note` | 1=participant_name, 2=project_name, 3=note | ملاحظة مشارك |

## مخطط قاعدة البيانات

```sql
notification_templates (
  key TEXT UNIQUE,                    -- يطابق اسم القالب في ChakraHQ
  name TEXT,                          -- الاسم الذي يظهر في الواجهة
  channel TEXT DEFAULT 'whatsapp',
  body_template TEXT,                 -- القالب المحلي (للمعاينة فقط)
  variables JSONB DEFAULT '[]',       -- متغيرات تلقائية من النظام
  manual_variables JSONB DEFAULT '[]',-- متغيرات يدوية من المستخدم
  meta_components JSONB DEFAULT '{}', -- ربط المتغيرات بمكونات Meta API
  is_active BOOLEAN DEFAULT true
)
```

## متى تستدعي هذه المهارة؟

- عند طلب إضافة قالب واتساب جديد
- عند تعديل متغيرات قالب موجود
- عند ربط قالب بحدث تلقائي جديد
- عند استكشاف أخطاء إرسال (Invalid parameter)
