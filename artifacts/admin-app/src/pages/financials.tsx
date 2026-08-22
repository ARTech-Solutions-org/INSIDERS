import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useListUshers, useListAllPayouts, useListAllTransactions, useCreateTransaction, useCreatePayout, useUpdatePayoutStatus, getListAllPayoutsQueryKey, getListUshersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from 'qrcode.react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, ArrowUpRight, ArrowDownRight, CreditCard, History, Coins } from "lucide-react";

export default function Financials() {
  const [activeTab, setActiveTab] = useState("balances");
  const { data: pendingPayouts } = useListAllPayouts({ status: "pending" }, { query: { refetchInterval: 5000 } as any });
  const pendingCount = pendingPayouts?.length || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Financials</h1>
        <p className="text-muted-foreground">Manage usher balances, payouts, and view transaction history.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="balances" className="gap-2"><Wallet className="w-4 h-4 hidden sm:block" /> Balances</TabsTrigger>
          <TabsTrigger value="payouts" className="gap-2 relative">
            <CreditCard className="w-4 h-4 hidden sm:block" /> 
            Payouts
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-background">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><History className="w-4 h-4 hidden sm:block" /> Payment History</TabsTrigger>
          <TabsTrigger value="transactions" className="gap-2"><Coins className="w-4 h-4 hidden sm:block" /> Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="balances" className="space-y-4">
          <BalancesTab />
        </TabsContent>

        <TabsContent value="payouts" className="space-y-4">
          <PayoutsTab status="pending" />
        </TabsContent>
        
        <TabsContent value="history" className="space-y-4">
          <PayoutsTab status="paid" />
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <TransactionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BalancesTab() {
  const { data: ushersResponse, isLoading } = useListUshers({ limit: 100 } as any, { query: { refetchInterval: 5000 } as any });
  
  if (isLoading) return <Skeleton className="w-full h-64" />;
  
  const ushers = ushersResponse?.data || [];
  
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usher</TableHead>
            <TableHead>Payment Method</TableHead>
            <TableHead className="text-right">Current Balance</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ushers.map((usher) => (
            <TableRow key={usher.id}>
              <TableCell className="font-medium">
                <div className="flex flex-col">
                  <span>{usher.fullName}</span>
                  <span className="text-xs text-muted-foreground">{usher.phone}</span>
                </div>
              </TableCell>
              <TableCell>
                {usher.paymentMethod ? (
                  <div className="flex flex-col">
                    <span className="capitalize">{usher.paymentMethod}</span>
                    <span className="text-xs text-muted-foreground">{usher.paymentMethodDetails}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm italic">Not set</span>
                )}
              </TableCell>
              <TableCell className="text-right font-bold text-lg">
                EGP {usher.balance.toFixed(2)}
              </TableCell>
              <TableCell className="text-right space-x-2">
                <AdjustBalanceDialog usher={usher} />
                <CreatePayoutDialog usher={usher} />
              </TableCell>
            </TableRow>
          ))}
          {ushers.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                No ushers found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function AdjustBalanceDialog({ usher }: { usher: any }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"credit" | "debit">("credit");
  const [reason, setReason] = useState("");
  const { toast } = useToast();
  
  const { mutate: createTx, isPending } = useCreateTransaction({
    mutation: {
      onSuccess: () => {
        toast({ title: "Balance Adjusted", description: `Successfully applied ${type} to usher's balance.` });
        setOpen(false);
        setAmount("");
        setReason("");
      },
      onError: (err: any) => {
        toast({ title: "Failed to adjust balance", description: err.message, variant: "destructive" });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount))) return;
    createTx({
      data: {
        usherId: usher.id,
        amount: Number(amount),
        type,
        reason: reason || undefined
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Adjust</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Balance</DialogTitle>
          <DialogDescription>
            Manually add or subtract funds for {usher.fullName}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Transaction Type</Label>
            <Select value={type} onValueChange={(v: "credit" | "debit") => setType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="credit">Credit (Add Funds)</SelectItem>
                <SelectItem value="debit">Debit (Subtract Funds)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Amount (EGP)</Label>
            <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Reason (Optional)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Bonus, Correction" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreatePayoutDialog({ usher }: { usher: any }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(usher.balance > 0 ? usher.balance.toString() : "");
  const [step, setStep] = useState<"form" | "success">("form");
  const method = usher.paymentMethod || "cash";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { mutate: createPayout, isPending } = useCreatePayout({
    mutation: {
      onSuccess: () => {
        toast({ title: "Payout Created", description: `Successfully created payout for ${usher.fullName}.` });
        queryClient.invalidateQueries({ queryKey: getListAllPayoutsQueryKey({ status: 'pending' }) as any });
        queryClient.invalidateQueries({ queryKey: getListAllPayoutsQueryKey({ status: 'paid' }) as any });
        queryClient.invalidateQueries({ queryKey: getListUshersQueryKey() as any });
        setStep("success");
      },
      onError: (err: any) => {
        toast({ title: "Failed to create payout", description: err.message, variant: "destructive" });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount))) return;
    createPayout({
      data: {
        usherId: usher.id,
        amount: Number(amount),
        method
      }
    });
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setTimeout(() => {
        setStep("form");
        setAmount(usher.balance > 0 ? usher.balance.toString() : "");
      }, 300);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">Payout</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{step === "form" ? "Create Payout" : "Payment Details"}</DialogTitle>
          <DialogDescription>
            {step === "form" 
              ? `Record a payout for ${usher.fullName}. This will automatically deduct from their balance.`
              : `Please transfer the following amount to ${usher.fullName}.`}
          </DialogDescription>
        </DialogHeader>
        
        {step === "form" ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Current Balance</Label>
              <div className="text-xl font-bold">EGP {usher.balance.toFixed(2)}</div>
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Input value={method} readOnly className="capitalize bg-muted" />
              <p className="text-xs text-muted-foreground">{usher.paymentMethodDetails}</p>
            </div>
            <div className="space-y-2">
              <Label>Payout Amount (EGP)</Label>
              <Input type="number" step="0.01" min="0.01" max={Math.max(usher.balance, 0.01)} value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending || usher.balance <= 0}>Confirm Payout</Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-lg border border-slate-100 space-y-4">
              <div className="text-center">
                <p className="text-sm font-medium text-slate-500 mb-1">Amount to Transfer</p>
                <p className="text-3xl font-bold text-slate-900">EGP {Number(amount).toFixed(2)}</p>
              </div>
              
              <div className="w-full h-px bg-slate-200"></div>
              
              <div className="text-center w-full">
                <p className="text-sm font-medium text-slate-500 mb-2">Transfer to ({method})</p>
                <div className="p-3 bg-white border border-slate-200 rounded-md font-mono text-lg font-semibold break-all">
                  {usher.paymentMethodDetails || "N/A"}
                </div>
              </div>

              {method.toLowerCase() === 'instapay' && usher.paymentMethodDetails && (
                <div className="flex flex-col items-center justify-center mt-4">
                  <QRCodeSVG 
                    value={
                      usher.paymentMethodDetails.startsWith('http') 
                        ? usher.paymentMethodDetails 
                        : `https://ipn.eg/S/${usher.paymentMethodDetails}`
                    } 
                    size={160} 
                    level="H" 
                    includeMargin={true}
                  />
                  <p className="mt-3 text-xs font-medium text-center text-slate-500">
                    Scan to pay via InstaPay
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" className="w-full" onClick={() => handleOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PayoutsTab({ status }: { status: "pending" | "paid" }) {
  const { data: payouts, isLoading } = useListAllPayouts({ status }, { query: { refetchInterval: 5000 } as any });

  if (isLoading) return <Skeleton className="w-full h-64" />;

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usher ID</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Status</TableHead>
            {status === "paid" && <TableHead>Paid At</TableHead>}
            {status === "pending" && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {payouts?.map((payout) => (
            <TableRow key={payout.id}>
              <TableCell className="font-medium">#{payout.usherId}</TableCell>
              <TableCell className="font-bold">EGP {payout.amount.toFixed(2)}</TableCell>
              <TableCell className="capitalize">{payout.method}</TableCell>
              <TableCell>
                <Badge variant={payout.status === 'paid' ? 'default' : payout.status === 'cancelled' ? 'destructive' : 'secondary'}>
                  {payout.status}
                </Badge>
              </TableCell>
              {status === "paid" && (
                <TableCell>
                  {payout.paidAt ? format(new Date(payout.paidAt), "MMM d, yyyy h:mm a") : "-"}
                </TableCell>
              )}
              {status === "pending" && (
                <TableCell className="text-right space-x-2">
                  <PayoutActions payout={payout} />
                </TableCell>
              )}
            </TableRow>
          ))}
          {(!payouts || payouts.length === 0) && (
            <TableRow>
              <TableCell colSpan={status === "pending" ? 5 : 5} className="text-center h-24 text-muted-foreground">
                No {status} payouts found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function PayoutActions({ payout }: { payout: any }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { mutate: updateStatus, isPending } = useUpdatePayoutStatus({
    mutation: {
      onSuccess: () => {
        toast({ title: "Status Updated", description: "Payout status was updated successfully." });
        queryClient.invalidateQueries({ queryKey: getListAllPayoutsQueryKey({ status: 'pending' }) as any });
        queryClient.invalidateQueries({ queryKey: getListAllPayoutsQueryKey({ status: 'paid' }) as any });
        queryClient.invalidateQueries({ queryKey: getListUshersQueryKey() as any });
        setOpen(false);
      }
    }
  });

  const method = payout.method || "cash";
  const paymentMethodDetails = payout.usher?.paymentMethodDetails || "";

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            Pay
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Payment</DialogTitle>
            <DialogDescription>
              Please transfer the requested amount to the usher.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-lg border border-slate-100 space-y-4">
              <div className="text-center">
                <p className="text-sm font-medium text-slate-500 mb-1">Amount to Transfer</p>
                <p className="text-3xl font-bold text-slate-900">EGP {Number(payout.amount).toFixed(2)}</p>
              </div>
              
              <div className="w-full h-px bg-slate-200"></div>
              
              <div className="text-center w-full">
                <p className="text-sm font-medium text-slate-500 mb-2">Transfer to ({method})</p>
                <div className="p-3 bg-white border border-slate-200 rounded-md font-mono text-lg font-semibold break-all">
                  {paymentMethodDetails || "N/A"}
                </div>
              </div>

              {method.toLowerCase() === 'instapay' && paymentMethodDetails && (
                <div className="flex flex-col items-center justify-center mt-4">
                  <QRCodeSVG 
                    value={
                      paymentMethodDetails.startsWith('http') 
                        ? paymentMethodDetails 
                        : `https://ipn.eg/S/${paymentMethodDetails}`
                    } 
                    size={160} 
                    level="H" 
                    includeMargin={true}
                  />
                  <p className="mt-3 text-xs font-medium text-center text-slate-500">
                    Scan to pay via InstaPay
                  </p>
                </div>
              )}
            </div>
            
            <DialogFooter className="flex space-x-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => updateStatus({ id: payout.id, data: { status: 'paid', paidAt: new Date().toISOString() } })}
                disabled={isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Confirm Paid
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
      <Button 
        variant="outline" 
        size="sm" 
        className="text-red-600 border-red-200 hover:bg-red-50 ml-2"
        disabled={isPending}
        onClick={() => updateStatus({ id: payout.id, data: { status: 'cancelled' } })}
      >
        Cancel
      </Button>
    </>
  );
}

function TransactionsTab() {
  const { data: transactions, isLoading } = useListAllTransactions({}, { query: { refetchInterval: 5000 } as any });

  if (isLoading) return <Skeleton className="w-full h-64" />;

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Usher ID</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions?.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell className="text-sm text-muted-foreground">
                {format(new Date(tx.createdAt), "MMM d, yyyy h:mm a")}
              </TableCell>
              <TableCell>#{tx.usherId}</TableCell>
              <TableCell>
                <Badge variant="outline" className={tx.type === 'credit' ? 'text-green-600 border-green-200' : 'text-red-600 border-red-200'}>
                  {tx.type.toUpperCase()}
                </Badge>
              </TableCell>
              <TableCell className="max-w-[200px] truncate" title={tx.reason || ""}>
                {tx.reason || "-"}
              </TableCell>
              <TableCell className="text-right font-bold">
                <div className="flex items-center justify-end gap-1">
                  {tx.type === 'credit' ? <ArrowUpRight className="w-4 h-4 text-green-500" /> : <ArrowDownRight className="w-4 h-4 text-red-500" />}
                  <span className={tx.type === 'credit' ? 'text-green-600' : 'text-red-600'}>
                    EGP {tx.amount.toFixed(2)}
                  </span>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {(!transactions || transactions.length === 0) && (
            <TableRow>
              <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                No transactions found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
