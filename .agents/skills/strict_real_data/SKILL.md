---
name: strict_real_data
description: Prevents using mock or experimental data when interacting with real systems and UIs.
---

# قواعد البيانات الحقيقية (Strict Real Data Policy)

## السياق
عندما يطلب المستخدم عدم استخدام بيانات تجريبية (Mock Data) أو "بناء تجريبي"، يجب عليك الالتزام المطلق بجلب وعرض البيانات الحقيقية من قاعدة البيانات فقط (مثل Supabase).

## التعليمات
1. **لا تستخدم متغيرات افتراضية (Mock Variables):** لا تقم بتعريف قيم ثابتة (Hardcoded) في واجهات المستخدم بقصد التجربة أو محاكاة التصميم (مثل `const executionRate = 78`).
2. **استخدم قاعدة البيانات:** قم دائماً بكتابة استعلامات حقيقية (Queries) لجلب البيانات من الجداول المتاحة.
3. **التعامل مع البيانات غير المتوفرة (Graceful Fallback):** إذا كانت البيانات المطلوبة غير موجودة في قاعدة البيانات (مثل جدول غير موجود أو حقل لم يتم إنشاؤه بعد)، اعرض `0` أو نصاً مثل "غير متوفر" أو "N/A" ولا تخترع أرقاماً عشوائية.
4. **لا تخلط بين الحقيقي والتجريبي:** لا يجوز أن تحتوي الشاشة الواحدة على أجزاء حقيقية وأجزاء وهمية إلا إذا طلب المستخدم ذلك صراحة وبشكل استثنائي.

## أمثلة
**مرفوض (وهمي):**
```typescript
const branchesCount = 3; // خطأ: بيانات تجريبية
```

**مقبول (حقيقي):**
```typescript
const [branchesCount, setBranchesCount] = useState(0);
// fetch from supabase: supabase.from('project_branches').select('*', { count: 'exact' })
```
