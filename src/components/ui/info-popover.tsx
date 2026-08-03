import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info } from "lucide-react";

export function InfoPopover({ text, title }: { text: string; title?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button 
          type="button" 
          onClick={(e) => e.stopPropagation()}
          className="text-muted-foreground hover:text-primary transition-colors focus:outline-none flex items-center justify-center rounded-full p-0.5 hover:bg-muted/50"
        >
          <Info className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 text-sm text-center rounded-xl z-[100]" side="top" align="center">
        {title && <p className="font-semibold mb-1 text-primary">{title}</p>}
        <p className="text-muted-foreground">{text}</p>
      </PopoverContent>
    </Popover>
  );
}
