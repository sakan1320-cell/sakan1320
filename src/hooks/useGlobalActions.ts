import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export const useGlobalActions = (table: string, onRefresh?: () => void) => {
  const { t } = useTranslation();

  const archive = async (id: string, currentStatus: string) => {
    try {
      const { error } = await supabase
        .from(table as any)
        .update({ status: 'archived' } as any)
        .eq('id', id);
      
      if (error) throw error;
      toast.success(t("common.archived", "تمت الأرشفة بنجاح"));
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const duplicate = async (id: string, nameField: string = 'name_ar') => {
    try {
      const { data: original, error: fetchError } = await supabase
        .from(table as any)
        .select('*')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;

      const orig = original as any;
      const { id: _, created_at: __, updated_at: ___, ...rest } = orig;
      const copy = {
        ...rest,
        [nameField]: `${orig[nameField]} (${t("common.copy", "نسخة")})`,
        status: orig.status === 'archived' ? 'planned' : orig.status
      };

      const { error: insertError } = await supabase
        .from(table as any)
        .insert(copy);
      
      if (insertError) throw insertError;
      toast.success(t("common.duplicated", "تم التكرار بنجاح"));
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const restore = async (id: string) => {
    try {
      const { error } = await supabase
        .from(table as any)
        .update({ status: 'planned' } as any)
        .eq('id', id);
      
      if (error) throw error;
      toast.success(t("common.restored", "تمت الاستعادة بنجاح"));
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return { archive, duplicate, restore };
};
