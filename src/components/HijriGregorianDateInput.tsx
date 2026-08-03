import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Calendar, DateObject } from "react-multi-date-picker";
import arabic from "react-date-object/calendars/arabic";
import gregorian from "react-date-object/calendars/gregorian";
import arabic_ar from "react-date-object/locales/arabic_ar";
import gregorian_ar from "react-date-object/locales/gregorian_ar";
import "./HijriGregorianDateInput.css";

const shortWeekDays = ["س", "ح", "ن", "ث", "ر", "خ", "ج"];

interface HijriGregorianDateInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function HijriGregorianDateInput({ value, onChange, className }: HijriGregorianDateInputProps) {
  const [calendarType, setCalendarType] = useState<"gregorian" | "hijri">(
    localStorage.getItem("calendar-hijri") === "true" ? "hijri" : "gregorian"
  );
  const [dateValue, setDateValue] = useState<Date | null>(null);
  const [open, setOpen] = useState(false);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value) {
      const parts = value.split("-").map(Number);
      if (parts.length === 3) {
        setDateValue(new Date(parts[0], parts[1] - 1, parts[2]));
      }
    } else {
      setDateValue(null);
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      const target = e.target as Node;
      const popup = document.getElementById("hijri-calendar-portal");
      if (inputRef.current && !inputRef.current.contains(target) && popup && !popup.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  // Calculate popup position relative to input
  const openCalendar = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setPopupStyle({
      position: "fixed",
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
      zIndex: 99999,
    });
    setOpen(true);
  }, []);

  const handleDateChange = (dateObj: any) => {
    if (!dateObj) { onChange(""); return; }
    const gDate = new Date(dateObj.toDate());
    const y = gDate.getFullYear();
    const m = (gDate.getMonth() + 1).toString().padStart(2, "0");
    const d = gDate.getDate().toString().padStart(2, "0");
    onChange(`${y}-${m}-${d}`);
    setOpen(false);
  };

  const toggleCalendarType = (type: "gregorian" | "hijri") => {
    setCalendarType(type);
    localStorage.setItem("calendar-hijri", (type === "hijri").toString());
  };

  // Display value: Hijri when calendarType=hijri, Gregorian otherwise
  const displayValue = (() => {
    if (!dateValue) return "";
    if (calendarType === "hijri") {
      try {
        const hijri = new DateObject({ date: dateValue, calendar: arabic, locale: arabic_ar });
        return `${hijri.year}/${String(hijri.month.number).padStart(2, "0")}/${String(hijri.day).padStart(2, "0")}`;
      } catch {
        return "";
      }
    }
    return `${dateValue.getFullYear()}/${String(dateValue.getMonth() + 1).padStart(2, "0")}/${String(dateValue.getDate()).padStart(2, "0")}`;
  })();

  const placeholder = calendarType === "hijri" ? "مثال: 1445/09/01" : "مثال: 2024/05/10";

  const popup = open ? (
    <div
      id="hijri-calendar-portal"
      className="hijri-calendar-popup"
      style={{ ...popupStyle, pointerEvents: "auto" }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Toggle */}
      <div className="hijri-calendar-toggle">
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleCalendarType("hijri"); }}
          className={`hijri-toggle-btn ${calendarType === "hijri" ? "active" : ""}`}
        >
          هجري
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleCalendarType("gregorian"); }}
          className={`hijri-toggle-btn ${calendarType === "gregorian" ? "active" : ""}`}
        >
          ميلادي
        </button>
      </div>

      {/* Calendar */}
      <div onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <Calendar
          key={calendarType}
          value={dateValue}
          onChange={handleDateChange}
          calendar={calendarType === "hijri" ? arabic : gregorian}
          locale={calendarType === "hijri" ? arabic_ar : gregorian_ar}
          weekDays={shortWeekDays}
          mapDays={({ date }: any) => {
            let secondaryLabel = "";
            try {
              if (calendarType === "hijri") {
                const gDate = new DateObject({ date: date.toDate(), calendar: gregorian });
                secondaryLabel = `(${gDate.day})`;
              } else {
                const hDate = new DateObject({ date: date.toDate(), calendar: arabic });
                secondaryLabel = `(${hDate.day})`;
              }
            } catch {}
            return {
              "data-secondary": secondaryLabel,
            };
          }}
        />
      </div>
    </div>
  ) : null;

  return (
    <div className={`w-full relative ${className || ""}`} dir="rtl">
      <input
        ref={inputRef}
        readOnly
        value={displayValue}
        placeholder={placeholder}
        className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-right"
        dir="rtl"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (open) setOpen(false);
          else openCalendar();
        }}
      />
      {typeof document !== "undefined" && createPortal(popup, document.body)}
    </div>
  );
}
