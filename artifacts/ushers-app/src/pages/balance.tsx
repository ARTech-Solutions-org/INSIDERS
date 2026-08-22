import React from 'react';
import { useGetMyBalance, useListMyTransactions, BalanceTransaction } from '@workspace/api-client-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Banknote, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { format } from 'date-fns';
import { useRequestMyPayout, useListMyPayouts } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

export default function Balance() {
  const { data: balanceData, isLoading: isBalanceLoading } = useGetMyBalance();
  const { data: transactionsData, isLoading: isTransactionsLoading } = useListMyTransactions({});
  const { data: payoutsData } = useListMyPayouts();

  const balance = balanceData?.balance || 0;
  
  const payouts = Array.isArray(payoutsData) 
    ? payoutsData 
    : (Array.isArray((payoutsData as any)?.data) ? (payoutsData as any).data : []);
    
  const pendingPayouts = payouts.filter((p: any) => p.status === 'pending');
  const totalPending = pendingPayouts.reduce((acc: number, p: any) => acc + Number(p.amount), 0);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");

  const { mutate: requestPayout, isPending: isRequesting } = useRequestMyPayout({
    mutation: {
      onSuccess: () => {
        toast({ title: "Payout Requested", description: "Your payout request has been submitted successfully." });
        queryClient.invalidateQueries();
        setOpen(false);
        setAmount("");
      },
      onError: (err: any) => {
        toast({ 
          title: "Failed to request payout", 
          description: err.response?.data?.error || err.message || "An unexpected error occurred", 
          variant: "destructive" 
        });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0 || Number(amount) > balance) return;
    requestPayout({ data: { amount: Number(amount) } });
  };
  const transactions: BalanceTransaction[] = Array.isArray(transactionsData)
    ? transactionsData
    : (Array.isArray((transactionsData as any)?.data) ? (transactionsData as any).data : []);

  return (
    <div className="p-5 flex flex-col h-full relative min-h-screen">
      <div className="pt-2 mb-6 relative z-10">
        <h1 className="brand-display text-4xl text-foreground mb-1 uppercase tracking-widest">BALANCE</h1>
        <p className="text-muted-foreground font-medium">Your earnings</p>
      </div>

      <div className="bg-primary p-8 rounded-2xl relative overflow-hidden mb-8 flex flex-col items-center text-center shadow-sm z-10">
        <Banknote className="w-8 h-8 text-primary-foreground/80 mb-3 relative z-10" strokeWidth={1.5} />
        <p className="brand-meta text-primary-foreground/70 mb-2 relative z-10">CURRENT BALANCE</p>

        {isBalanceLoading ? (
          <Skeleton className="h-12 w-48 bg-primary-foreground/20 rounded-xl relative z-10" />
        ) : (
            <p className="brand-display text-5xl tracking-wide text-primary-foreground relative z-10">
              <span className="text-2xl mr-2 text-primary-foreground/70">EGP</span>
              {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}

          {totalPending > 0 && (
            <div className="mt-4 bg-primary-foreground/10 border border-primary-foreground/20 text-primary-foreground/90 px-4 py-2 rounded-lg text-sm font-medium relative z-10 flex flex-col items-center">
              <span>EGP {totalPending.toLocaleString(undefined, { minimumFractionDigits: 2 })} pending approval</span>
            </div>
          )}

          {balance > 0 && (
            <div className="mt-6 w-full max-w-[200px] relative z-10">
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button variant="secondary" className="w-full bg-white text-primary hover:bg-slate-100 font-bold uppercase tracking-wider h-11">
                    Request Payout
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Request Payout</DialogTitle>
                    <DialogDescription>
                      Enter the amount you would like to withdraw from your balance.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label>Amount (EGP)</Label>
                      <Input 
                        type="number" 
                        step="0.01" 
                        min="0.01" 
                        max={balance} 
                        value={amount} 
                        onChange={(e) => setAmount(e.target.value)} 
                        placeholder={balance.toString()} 
                        required 
                      />
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={isRequesting || !amount || Number(amount) <= 0 || Number(amount) > balance}>
                        Submit Request
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

      <div className="flex-1 relative z-10">
        <h2 className="brand-display text-xl mb-4 uppercase tracking-wide border-b border-border/50 pb-2">RECENT TRANSACTIONS</h2>

        {isTransactionsLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl border border-border" />)}
          </div>
        ) : transactions.length === 0 ? (
          <div className="border border-border/50 bg-card p-10 text-center mt-6 flex flex-col items-center justify-center relative overflow-hidden rounded-2xl shadow-sm">
            <p className="brand-meta text-foreground/60 relative z-10 mb-1">NO TRANSACTIONS YET</p>
          </div>
        ) : (
          <div className="space-y-3 pb-safe">
            {transactions.map(tx => {
              const isCredit = tx.type === 'credit';
              const isDebit = tx.type === 'debit';
              const isPayout = tx.type === 'payout';

              return (
                <div key={tx.id} className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 border rounded-full flex items-center justify-center ${isCredit ? 'bg-green-500/10 text-green-600 border-green-500/20' : isPayout ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'}`}>
                      {isCredit ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-bold text-sm tracking-wide uppercase">{tx.type}</p>
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">{format(new Date(tx.createdAt), 'MMM d, h:mm a').toUpperCase()}</p>
                      {tx.reason && <p className="text-xs text-muted-foreground truncate max-w-[150px] mt-1 font-medium">{tx.reason}</p>}
                    </div>
                  </div>
                  <div className={`text-right font-bold tracking-wide ${isCredit ? 'text-green-600' : isPayout ? 'text-blue-600' : 'text-red-600'}`}>
                    {isCredit ? '+' : '-'}EGP {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
