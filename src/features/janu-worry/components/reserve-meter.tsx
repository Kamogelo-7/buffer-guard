import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Lock, ShieldCheck, AlertOctagon } from "lucide-react";
import { OutlookStatus } from "../../../domain/types";

interface ReserveMeterProps {
  lockedAmountFormatted: string;
  spendableRemainingFormatted: string;
  status: OutlookStatus;
  burnRateFormatted: string;
}

export function ReserveMeter({
  lockedAmountFormatted,
  spendableRemainingFormatted,
  status,
  burnRateFormatted,
}: ReserveMeterProps) {
  const isSafe = status === "SAFE";
  const isBreach = status === "BREACH";

  return (
    <Card className={isBreach ? "border-red-400 bg-red-50/30" : "border-emerald-300 bg-emerald-50/20"}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Lock className="h-5 w-5 text-indigo-600" />
            Untouchable January Reserve
          </CardTitle>
          {isSafe ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
              <ShieldCheck className="h-3.5 w-3.5" /> INTACT & SAFE
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 px-2.5 py-1 rounded-full">
              <AlertOctagon className="h-3.5 w-3.5" /> RESERVE AT RISK
            </span>
          )}
        </div>
        <CardDescription>
          Guaranteed financial buffer ring-fenced for January liabilities.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Locked Target</p>
            <p className="text-2xl font-black text-slate-900">{lockedAmountFormatted}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Remaining Festive Spend</p>
            <p className="text-2xl font-black text-emerald-700">{spendableRemainingFormatted}</p>
          </div>
        </div>
        <div className="border-t pt-3 flex items-center justify-between text-xs text-slate-600">
          <span>Daily Safe Burn Pace:</span>
          <span className="font-mono font-bold text-slate-900">{burnRateFormatted}</span>
        </div>
      </CardContent>
    </Card>
  );
}
