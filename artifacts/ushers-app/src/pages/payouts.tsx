import React from 'react';
import { useListMyPayouts } from '@workspace/api-client-react';
import { CreditCard, ArrowUpRight, Clock, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

export default function Payouts() {
  const { data: payouts, isLoading } = useListMyPayouts();
  const safePayouts = Array.isArray(payouts) 
    ? payouts 
    : (Array.isArray((payouts as any)?.data) ? (payouts as any).data : []);

  return (
    <div className="p-5 flex flex-col h-full relative min-h-screen">
      <div className="pt-2 mb-6 relative z-10">
        <h1 className="brand-display text-4xl text-foreground mb-1 uppercase tracking-widest">PAYOUT HISTORY</h1>
        <p className="text-muted-foreground font-medium">Money moved</p>
      </div>

      {isLoading ? (
        <div className="space-y-4 relative z-10">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl border border-border" />)}
        </div>
      ) : safePayouts.length === 0 ? (
        <div className="border border-border/50 bg-card p-10 text-center mt-6 flex flex-col items-center justify-center relative overflow-hidden z-10 rounded-2xl shadow-sm">
          <CreditCard className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3 relative z-10" />
          <p className="brand-meta text-foreground/60 relative z-10 mb-1">NO PAYOUTS YET</p>
        </div>
      ) : (
        <div className="space-y-3 pb-safe relative z-10">
          {safePayouts.map((payout: any) => {
            const isCompleted = payout.status === 'completed';

            return (
              <div key={payout.id} className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-5 w-full">
                  <div className={`w-12 h-12 border rounded-full flex items-center justify-center shrink-0 ${isCompleted ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-secondary/10 text-secondary border-secondary/20'}`}>
                    <ArrowUpRight className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="brand-display text-xl tracking-wide">EGP {payout.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`brand-meta px-2 py-1 border rounded-md flex items-center gap-1 ${isCompleted ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-secondary/10 text-secondary border-secondary/20'}`}>
                        {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {payout.status}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground uppercase bg-background border border-border rounded-md px-2 py-1">{payout.method}</span>
                    </div>
                  </div>
                  {payout.paidAt && (
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">PAID ON</p>
                      <p className="text-sm font-bold tracking-wide uppercase">{format(new Date(payout.paidAt), 'MMM d, yy')}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
