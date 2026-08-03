---
name: radix_dialog_portal_pointer_events
description: >
  يُفعَّل هذا الدليل عند استخدام createPortal داخل أي نافذة Radix UI (Dialog, Sheet, Popover, etc.)
  أو عند ملاحظة أن عناصر مُعروضة عبر Portal لا تستجيب للنقرات.
  المشكلة: Radix يضيف pointer-events: none على document.body عند فتح الـ Dialog.
---

# Radix Dialog + createPortal: Pointer Events Fix

## المشكلة

عند استخدام `createPortal(element, document.body)` داخل Radix UI Dialog أو Sheet، يتم عرض العنصر بشكل صحيح بصرياً، لكن **النقرات لا تعمل**.

السبب: Radix UI يضيف تلقائياً `pointer-events: none` على `document.body` عند فتح أي Dialog/Sheet لمنع التفاعل مع العناصر خارج النافذة. أي عنصر يُعرض عبر createPortal في `document.body` يرث هذا الخاصية.

## الحل الإلزامي

عند استخدام `createPortal` داخل سياق Radix، يجب دائماً إضافة:

### 1. Inline Style على عنصر البورتال
```tsx
<div
  style={{ pointerEvents: "auto" }}
  ...
>
```

### 2. CSS على العنصر وكل أبناءه
```css
.my-portal-element {
  pointer-events: auto !important;
}

.my-portal-element * {
  pointer-events: auto !important;
}
```

### 3. مثال كامل
```tsx
const popup = (
  <div
    id="my-portal"
    style={{
      position: "fixed",
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
      zIndex: 99999,
      pointerEvents: "auto",  // ← إلزامي لتجاوز Radix
    }}
  >
    {children}
  </div>
);

createPortal(popup, document.body);
```

## قواعد إضافية

- **لا تستخدم `portal={true}` في `react-multi-date-picker`** داخل Radix Dialogs — يسبب نفس المشكلة
- **عند إغلاق التقويم بالنقر خارجه** استخدم `document.addEventListener("mousedown")` مع فحص `.contains(target)` على عنصر البورتال بـ `document.getElementById`
- **عند رغبتك في استخدام التقويم داخل Dialog**، استخدم `Calendar` المستقل مع `createPortal` إلى `document.body` مع `pointerEvents: "auto"` — لا تستخدم `DatePicker` مع portal
