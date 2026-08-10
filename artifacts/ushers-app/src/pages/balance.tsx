import React from 'react';
import { useGetMyBalance, useListMyTransactions, BalanceTransaction } from '@workspace/api-client-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Banknote, ArrowDownRight, ArrowUpRight, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function Balance() {
  const { data: balanceData, isLoading: isBalanceLoading } = useGetMyBalance();
  const { data: transactionsData, isLoading: isTransactionsLoading } = useListMyTransactions({});
  
  const balance = balanceData?.balance || 0;
  const transactions: BalanceTransaction[] = Array.isArray(transactionsData) 
    ? transactionsData 
    : (Array.isArray((transactionsData as any)?.data) ? (transactionsData as any).data : []);

  return (
    <div className="p-4 flex flex-col h-full">
      <h1 className="text-2xl font-bold text-foreground mb-4">Balance</h1>

      <div className="bg-primary text-primary-foreground p-6 rounded-3xl shadow-xl relative overflow-hidden mb-6 flex flex-col items-center text-center">
        <div className="absolute left-0 bottom-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -ml-10 -mb-10" />
        <div className="absolute right-0 top-0 w-32 h-32 bg-secondary/20 rounded-full blur-2xl -mr-10 -mt-10" />
        
        <Banknote className="w-8 h-8 text-secondary mb-3 opacity-80" />
        <p className="text-primary-foreground/70 text-sm uppercase tracking-widest font-semibold mb-1">Current Balance</p>
        
        {isBalanceLoading ? (
          <Skeleton className="h-12 w-48 bg-primary-foreground/20 rounded-xl" />
        ) : (
          <p className="text-4xl font-bold tracking-tight">
            <span className="text-2xl mr-1 text-primary-foreground/80">EGP</span>
            {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        )}
      </div>

      <div className="flex-1">
        <h2 className="text-lg font-bold mb-4">Recent Transactions</h2>
        
        {isTransactionsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
          </div>
        ) : transactions.length === 0 ? (
          <div className="bg-muted/30 border border-dashed border-border rounded-2xl p-8 text-center">
            <Clock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No transactions yet</p>
          </div>
        ) : (
          <div className="space-y-3 pb-safe">
            {transactions.map(tx => {
              const isCredit = tx.type === 'credit';
              const isDebit = tx.type === 'debit';
              const isPayout = tx.type === 'payout';
              
              return (
                <div key={tx.id} className="bg-card border border-border p-4 rounded-2xl shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isCredit ? 'bg-green-500/10 text-green-600' : isPayout ? 'bg-blue-500/10 text-blue-600' : 'bg-red-500/10 text-red-600'}`}>
                      {isCredit ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-semibold text-sm capitalize">{tx.type}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(tx.createdAt), 'MMM d, h:mm a')}</p>
                      {tx.reason && <p className="text-xs text-muted-foreground truncate max-w-[150px] mt-0.5">{tx.reason}</p>}
                    </div>
                  </div>
                  <div className={`text-right font-bold ${isCredit ? 'text-green-600' : isPayout ? 'text-blue-600' : 'text-red-600'}`}>
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
