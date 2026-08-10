import React from 'react';
import { useListMyPayouts } from '@workspace/api-client-react';
import { CreditCard, ArrowUpRight, Clock, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

export default function Payouts() {
  const { data: payouts, isLoading } = useListMyPayouts();
  const safePayouts = Array.isArray(payouts) ? payouts : [];

  return (
    <div className="p-4 flex flex-col h-full">
      <h1 className="text-2xl font-bold text-foreground mb-6">Payout History</h1>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
        </div>
      ) : safePayouts.length === 0 ? (
        <div className="bg-muted/30 border border-dashed border-border rounded-2xl p-8 text-center mt-10">
          <CreditCard className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No payouts yet</p>
        </div>
      ) : (
        <div className="space-y-3 pb-safe">
          {safePayouts.map(payout => {
            const isCompleted = payout.status === 'completed';
            
            return (
              <div key={payout.id} className="bg-card border border-border p-4 rounded-2xl shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${isCompleted ? 'bg-green-500/10 text-green-600' : 'bg-secondary/10 text-secondary'}`}>
                    <ArrowUpRight className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-lg">EGP {payout.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 ${isCompleted ? 'bg-green-500/10 text-green-600' : 'bg-secondary/10 text-secondary'}`}>
                        {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {payout.status}
                      </span>
                      <span className="text-xs text-muted-foreground uppercase">{payout.method}</span>
                    </div>
                    {payout.paidAt && (
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Paid on {format(new Date(payout.paidAt), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
