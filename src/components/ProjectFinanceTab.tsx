import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ArrowDownCircle, ArrowUpCircle, Wallet } from "lucide-react";

interface Tx {
  id: string;
  amount: number;
  direction: "income" | "expense";
  currency: string;
  transaction_date: string;
  party: string | null;
  category: string | null;
  description: string | null;
}

export const ProjectFinanceTab = ({ projectId }: { projectId: string }) => {
  const { t } = useTranslation();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("finance_transactions")
        .select("id,amount,direction,currency,transaction_date,party,category,description")
        .eq("project_id", projectId)
        .order("transaction_date", { ascending: false });
      setTxs((data ?? []) as Tx[]);
      setLoading(false);
    })();
  }, [projectId]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const totalIn = txs.filter((x) => x.direction === "income").reduce((s, x) => s + Number(x.amount), 0);
  const totalOut = txs.filter((x) => x.direction === "expense").reduce((s, x) => s + Number(x.amount), 0);
  const balance = totalIn - totalOut;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={ArrowDownCircle} label={t("finance.totalIn", "إجمالي الوارد")} value={totalIn} tone="success" />
        <Stat icon={ArrowUpCircle} label={t("finance.totalOut", "إجمالي الصادر")} value={totalOut} tone="danger" />
        <Stat icon={Wallet} label={t("finance.balance", "الرصيد")} value={balance} tone={balance >= 0 ? "success" : "danger"} />
      </div>
      <Card>
        <CardContent className="p-0">
          {txs.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{t("common.none")}</p>
          ) : (
            <div className="divide-y">
              {txs.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{tx.description || tx.category || tx.party || "-"}</div>
                    <div className="text-xs text-muted-foreground">{tx.transaction_date}{tx.party ? ` · ${tx.party}` : ""}</div>
                  </div>
                  <div className={tx.direction === "income" ? "text-success font-semibold" : "text-destructive font-semibold"}>
                    {tx.direction === "income" ? "+" : "-"}{Number(tx.amount).toLocaleString()} {tx.currency}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const Stat = ({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: "success" | "danger" }) => (
  <Card>
    <CardContent className="flex items-center gap-3 p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone === "success" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-bold">{value.toLocaleString()}</div>
      </div>
    </CardContent>
  </Card>
);
