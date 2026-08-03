import { supabase } from "@/integrations/supabase/client";

export const logSystemError = async (error: Error | Event, info?: any) => {
  try {
    let message = "Unknown error";
    let stack_trace = "";
    
    if (error instanceof Error) {
      message = error.message;
      stack_trace = error.stack || JSON.stringify(info);
    } else if (typeof error === "string") {
      message = error;
      stack_trace = JSON.stringify(info);
    } else if (error && typeof error === "object") {
      message = (error as any).message || JSON.stringify(error);
      stack_trace = JSON.stringify(info);
    }

    const { data: { user } } = await supabase.auth.getUser();

    // Fire and forget
    supabase.from("system_errors").insert({
      message,
      stack_trace,
      url: window.location.href,
      user_id: user?.id || null
    }).then(({ error: dbError }) => {
      if (dbError) {
        console.error("Failed to log system error to database:", dbError);
      }
    });
  } catch (e) {
    console.error("Error in logSystemError:", e);
  }
};

export const initGlobalErrorLogger = () => {
  window.addEventListener("error", (event) => {
    logSystemError(event.error || event.message, { filename: event.filename, lineno: event.lineno, colno: event.colno });
  });

  window.addEventListener("unhandledrejection", (event) => {
    logSystemError(event.reason || "Unhandled Promise Rejection");
  });
};
