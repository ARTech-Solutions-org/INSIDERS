import React, { useState } from 'react';
import { useListMyDocuments, useAddMyDocument, getListMyDocumentsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, UploadCloud, Calendar, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function Documents() {
  const { data: documents, isLoading } = useListMyDocuments();
  const addMutation = useAddMyDocument();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [docType, setDocType] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const handleAdd = () => {
    if (!docType) {
      toast.error('Document type is required');
      return;
    }

    addMutation.mutate({
      data: {
        docType,
        fileUrl: 'https://example.com/dummy.pdf', // In a real app, upload first
        fileKey: 'dummy-key',
        expiryDate: expiryDate ? new Date(expiryDate).toISOString() : undefined
      }
    }, {
      onSuccess: () => {
        toast.success('Document added');
        setOpen(false);
        setDocType('');
        setExpiryDate('');
        queryClient.invalidateQueries({ queryKey: getListMyDocumentsQueryKey() });
      },
      onError: (err) => toast.error(err.message || 'Failed to add document')
    });
  };

  const safeDocs = Array.isArray(documents) ? documents : [];

  return (
    <div className="p-5 flex flex-col h-full relative min-h-screen">
      <div className="flex items-end justify-between pt-2 mb-6 relative z-10 border-b border-border/50 pb-4">
        <div>
          <h1 className="brand-display text-4xl text-foreground mb-1 uppercase tracking-widest">DOCUMENTS</h1>
          <p className="text-muted-foreground font-medium">Keep it current</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-lg border-border font-bold text-[10px] tracking-widest uppercase shadow-sm">
              <Plus className="w-3 h-3 mr-1" /> ADD DOC
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[90vw] max-w-[400px] rounded-2xl border border-border p-6 bg-card shadow-lg">
            <DialogHeader>
              <DialogTitle className="brand-display text-2xl uppercase tracking-wide">UPLOAD DOCUMENT</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 pt-4">
              <div className="space-y-2">
                <label className="font-semibold text-xs text-foreground/90">Document Type</label>
                <Input value={docType} onChange={e => setDocType(e.target.value)} placeholder="e.g., ID Card, Health Certificate" className="rounded-xl border-border h-11" />
              </div>

              <div className="space-y-2">
                <label className="font-semibold text-xs text-foreground/90">Expiration Date (Optional)</label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={e => setExpiryDate(e.target.value)}
                  className="rounded-xl border-border h-11"
                />
              </div>

              <Button className="w-full rounded-xl h-11 text-xs font-bold tracking-widest uppercase mt-4 shadow-sm" onClick={handleAdd} disabled={addMutation.isPending}>
                {addMutation.isPending ? 'UPLOADING...' : 'SAVE DOCUMENT'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-4 relative z-10">
          {[1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl border border-border" />)}
        </div>
      ) : safeDocs.length === 0 ? (
        <div className="border border-border/50 bg-card p-10 text-center mt-6 flex flex-col items-center justify-center relative overflow-hidden z-10 rounded-2xl shadow-sm">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3 relative z-10" />
          <p className="brand-meta text-foreground/60 relative z-10 mb-1">NO DOCUMENTS UPLOADED</p>
          <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest relative z-10">ADD YOUR ID AND CERTIFICATES</p>
        </div>
      ) : (
        <div className="space-y-3 pb-safe relative z-10">
          {safeDocs.map(doc => {
            const isExpiringSoon = doc.expiryDate && new Date(doc.expiryDate).getTime() - new Date().getTime() < 30 * 24 * 60 * 60 * 1000;
            const isExpired = doc.expiryDate && new Date(doc.expiryDate) < new Date();

            return (
              <div key={doc.id} className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 border rounded-full flex items-center justify-center ${isExpired ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-primary/5 text-primary border-primary/20'}`}>
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold tracking-wide uppercase">{doc.docType}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`brand-meta px-2 py-1 border rounded-md ${doc.status === 'approved' ? 'bg-green-500/10 text-green-600 border-green-500/20' : doc.status === 'rejected' ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-secondary/10 text-secondary border-secondary/20'}`}>
                        {doc.status}
                      </span>
                    </div>
                    {doc.expiryDate && (
                      <p className={`text-[10px] font-mono flex items-center gap-1 mt-2 uppercase tracking-widest ${isExpired ? 'text-destructive font-bold' : isExpiringSoon ? 'text-secondary font-bold' : 'text-muted-foreground'}`}>
                        <Calendar className="w-3 h-3" />
                        {isExpired ? 'EXPIRED' : 'EXPIRES'}: {format(new Date(doc.expiryDate), 'MMM d, yyyy').toUpperCase()}
                        {isExpiringSoon && !isExpired && <AlertCircle className="w-3 h-3 ml-1" />}
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
