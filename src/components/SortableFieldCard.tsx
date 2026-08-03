import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Edit2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SortableFieldCardProps {
  id: string;
  name: string;
  type: string;
  isRequired: boolean;
  onEdit: () => void;
  onDelete?: () => void;
  canDelete: boolean;
  isRtl: boolean;
  fieldTypeLabels: Record<string, string>;
}

export function SortableFieldCard({ id, name, type, isRequired, onEdit, onDelete, canDelete, isRtl, fieldTypeLabels }: SortableFieldCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative flex items-center p-3 sm:p-4 mb-3 rounded-xl border bg-card text-card-foreground shadow-sm transition-all duration-200 hover:border-primary hover:-translate-y-0.5 hover:shadow-md ${isDragging ? "border-primary ring-1 ring-primary shadow-lg" : "border-border/60"}`}
    >
      {/* Drag Handle on the start (Right for RTL, Left for LTR) */}
      <div 
        {...attributes} 
        {...listeners}
        className="cursor-grab active:cursor-grabbing hover:text-primary p-2 -ms-2 -my-2 me-2 opacity-40 hover:opacity-100 transition-opacity touch-none"
      >
        <GripVertical className="h-5 w-5" />
      </div>

      {/* Field Details */}
      <div className="flex-1 flex flex-wrap items-center gap-3">
        <span className="font-bold text-base">{name}</span>
        <Badge variant="secondary" className="text-xs font-normal">
          {fieldTypeLabels[type] || type}
        </Badge>
        {isRequired && (
          <Badge variant="destructive" className="text-xs font-normal bg-destructive/10 text-destructive hover:bg-destructive/20 border-none">
            {isRtl ? "إلزامي" : "Required"}
          </Badge>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onEdit} className="text-muted-foreground hover:text-primary transition-colors">
          <Edit2 className="h-4 w-4" />
        </Button>
        {canDelete && onDelete && (
          <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
