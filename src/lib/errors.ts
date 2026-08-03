/**
 * Converts technical Supabase/database errors into user-friendly Arabic messages.
 */
export function friendlyError(error: { message?: string } | null | undefined): string {
  if (!error?.message) return "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.";
  const msg = error.message.toLowerCase();

  // Auth errors
  if (msg.includes("invalid login credentials") || msg.includes("invalid password")) {
    return "بيانات الدخول غير صحيحة. يرجى التحقق من البريد الإلكتروني وكلمة المرور.";
  }
  if (msg.includes("email not confirmed")) {
    return "البريد الإلكتروني غير مؤكد. يرجى مراجعة بريدك الإلكتروني.";
  }
  if (msg.includes("user already registered") || msg.includes("already exists")) {
    return "هذا البريد الإلكتروني مسجل مسبقاً.";
  }
  if (msg.includes("password should be at least")) {
    return "كلمة المرور قصيرة جداً. يجب أن تكون 6 أحرف على الأقل.";
  }
  if (msg.includes("too many requests") || msg.includes("rate limit")) {
    return "تجاوزت عدد المحاولات المسموح بها. يرجى الانتظار قبل المحاولة مجدداً.";
  }
  if (msg.includes("jwt expired") || msg.includes("token is expired")) {
    return "انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجدداً.";
  }

  // Database constraint errors
  if (msg.includes("duplicate key value violates unique constraint")) {
    return "هذا السجل موجود مسبقاً. لا يمكن تكرار البيانات.";
  }
  if (msg.includes("violates foreign key constraint")) {
    return "لا يمكن تنفيذ هذه العملية لأن البيانات مرتبطة بسجلات أخرى.";
  }
  if (msg.includes("violates not-null constraint") || msg.includes("null value in column")) {
    return "يرجى ملء جميع الحقول المطلوبة.";
  }
  if (msg.includes("value too long") || msg.includes("character varying")) {
    return "النص المُدخل طويل جداً. يرجى تقصيره.";
  }
  if (msg.includes("new row violates row-level security")) {
    return "ليس لديك صلاحية لتنفيذ هذه العملية.";
  }
  if (msg.includes("permission denied")) {
    return "ليس لديك صلاحية الوصول لهذه البيانات.";
  }
  if (msg.includes("connection") || msg.includes("network") || msg.includes("timeout")) {
    return "خطأ في الاتصال بالشبكة. يرجى التحقق من اتصالك بالإنترنت.";
  }

  // Generic fallback - return original if short enough
  if (error.message.length < 80) return error.message;
  return "حدث خطأ في المعالجة. يرجى المحاولة مرة أخرى أو التواصل مع الدعم الفني.";
}
