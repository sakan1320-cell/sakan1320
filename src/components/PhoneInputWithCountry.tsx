import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const COUNTRY_CODES = [
  { code: "+966", label: "السعودية", flag: "🇸🇦" },
  { code: "+971", label: "الإمارات", flag: "🇦🇪" },
  { code: "+965", label: "الكويت", flag: "🇰🇼" },
  { code: "+974", label: "قطر", flag: "🇶🇦" },
  { code: "+973", label: "البحرين", flag: "🇧🇭" },
  { code: "+968", label: "عُمان", flag: "🇴🇲" },
  { code: "+962", label: "الأردن", flag: "🇯🇴" },
  { code: "+20",  label: "مصر",     flag: "🇪🇬" },
  { code: "+967", label: "اليمن",   flag: "🇾🇪" },
  { code: "+964", label: "العراق",  flag: "🇮🇶" },
  { code: "+963", label: "سوريا",   flag: "🇸🇾" },
  { code: "+961", label: "لبنان",   flag: "🇱🇧" },
  { code: "+970", label: "فلسطين",  flag: "🇵🇸" },
  { code: "+249", label: "السودان",  flag: "🇸🇩" },
  { code: "+212", label: "المغرب",  flag: "🇲🇦" },
  { code: "+213", label: "الجزائر",  flag: "🇩🇿" },
  { code: "+216", label: "تونس",   flag: "🇹🇳" },
  { code: "+218", label: "ليبيا",   flag: "🇱🇾" },
  { code: "+90",  label: "تركيا",   flag: "🇹🇷" },
  { code: "+1",   label: "أمريكا/كندا", flag: "🇺🇸" },
  { code: "+44",  label: "بريطانيا", flag: "🇬🇧" },
];

const sanitizeLocal = (s: string) => {
  return s.replace(/\D/g, "").replace(/^0+/, "");
};

interface PhoneInputWithCountryProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function PhoneInputWithCountry({
  value,
  onChange,
  placeholder = "5XXXXXXXX",
  className,
  disabled = false,
}: PhoneInputWithCountryProps) {
  const [dial, setDial] = useState("+966");
  const [local, setLocal] = useState("");
  const [open, setOpen] = useState(false);

  // Sync state with value prop
  useEffect(() => {
    const trimmed = (value || "").trim();
    if (!trimmed) {
      if (local !== "") {
        setLocal("");
      }
      return;
    }

    // Split logic
    let matchedDial = "+966";
    let matchedLocal = trimmed;

    if (trimmed.startsWith("+")) {
      const found = COUNTRY_CODES.find((c) => trimmed.startsWith(c.code));
      if (found) {
        matchedDial = found.code;
        matchedLocal = trimmed.slice(found.code.length);
      }
    } else {
      // Find code starting without '+' (e.g. 966)
      // Sort by length desc to check longer matches first (+1 vs +966)
      const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
      const found = sorted.find((c) => trimmed.startsWith(c.code.slice(1)));
      if (found) {
        matchedDial = found.code;
        matchedLocal = trimmed.slice(found.code.length - 1);
      }
    }

    const cleanLocal = sanitizeLocal(matchedLocal);
    
    // Only update state if it is different to prevent loops
    if (matchedDial !== dial) {
      setDial(matchedDial);
    }
    if (cleanLocal !== local) {
      setLocal(cleanLocal);
    }
  }, [value]);

  // Handle local input changes
  const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const clean = sanitizeLocal(rawVal);
    setLocal(clean);
    
    // Propagate change (always format with the + sign)
    const fullNumber = clean ? `${dial}${clean}` : "";
    onChange(fullNumber);
  };

  // Handle country selection
  const handleCountrySelect = (code: string) => {
    setDial(code);
    setOpen(false);
    
    // Propagate change
    const fullNumber = local ? `${code}${local}` : "";
    onChange(fullNumber);
  };

  const selectedCountry = COUNTRY_CODES.find((c) => c.code === dial) || COUNTRY_CODES[0];

  return (
    <div className={cn("flex gap-2 items-center", className)} dir="ltr">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild disabled={disabled}>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="flex items-center gap-1 px-2 shrink-0 h-10 border bg-background"
          >
            <span className="text-sm font-medium" dir="ltr">{selectedCountry.code}</span>
            <ChevronsUpDown className="h-3 w-3 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" align="start">
          <Command
            filter={(value, search) => {
              const q = search.toLowerCase();
              return value.toLowerCase().includes(q) ? 1 : 0;
            }}
          >
            <CommandInput placeholder="ابحث عن رمز..." className="text-right h-8 text-xs" />
            <CommandList>
              <CommandEmpty className="py-2 text-center text-xs">لا توجد نتائج.</CommandEmpty>
              <CommandGroup>
                {COUNTRY_CODES.map((c) => (
                  <CommandItem
                    key={c.code}
                    value={`${c.label} ${c.code}`}
                    onSelect={() => handleCountrySelect(c.code)}
                    className="flex items-center justify-between py-1.5"
                  >
                    <div className="flex items-center gap-1.5">
                      <Check
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          dial === c.code ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="text-sm">{c.flag}</span>
                      <span className="text-xs font-medium">{c.label}</span>
                    </div>
                    <span className="text-muted-foreground text-[10px]">{c.code}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Input
        type="tel"
        value={local}
        onChange={handleLocalChange}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 text-left h-10"
        dir="ltr"
        inputMode="tel"
      />
    </div>
  );
}
