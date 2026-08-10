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
    <div className="p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Documents</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-xl font-semibold">
              <Plus className="w-4 h-4 mr-1" /> Add Doc
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[90vw] max-w-[400px] rounded-2xl">
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Document Type</label>
                <Input value={docType} onChange={e => setDocType(e.target.value)} placeholder="e.g., ID Card, Health Certificate" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Expiration Date (Optional)</label>
                <Input 
                  type="date"
                  value={expiryDate}
                  onChange={e => setExpiryDate(e.target.value)}
                />
              </div>

              <Button className="w-full rounded-xl mt-2" onClick={handleAdd} disabled={addMutation.isPending}>
                {addMutation.isPending ? 'Uploading...' : 'Save Document'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
        </div>
      ) : safeDocs.length === 0 ? (
        <div className="bg-muted/30 border border-dashed border-border rounded-2xl p-8 text-center mt-10">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No documents uploaded</p>
          <p className="text-xs text-muted-foreground mt-1">Add your ID and certificates here.</p>
        </div>
      ) : (
        <div className="space-y-3 pb-safe">
          {safeDocs.map(doc => {
            const isExpiringSoon = doc.expiryDate && new Date(doc.expiryDate).getTime() - new Date().getTime() < 30 * 24 * 60 * 60 * 1000;
            const isExpired = doc.expiryDate && new Date(doc.expiryDate) < new Date();
            
            return (
              <div key={doc.id} className="bg-card border border-border p-4 rounded-2xl shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isExpired ? 'bg-destructive/10 text-destructive' : 'bg-primary/5 text-primary'}`}>
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-semibold">{doc.docType}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${doc.status === 'approved' ? 'bg-green-500/10 text-green-600' : doc.status === 'rejected' ? 'bg-destructive/10 text-destructive' : 'bg-secondary/10 text-secondary'}`}>
                        {doc.status}
                      </span>
                    </div>
                    {doc.expiryDate && (
                      <p className={`text-xs flex items-center gap-1 mt-1.5 ${isExpired ? 'text-destructive font-semibold' : isExpiringSoon ? 'text-secondary font-semibold' : 'text-muted-foreground'}`}>
                        <Calendar className="w-3 h-3" />
                        {isExpired ? 'Expired' : 'Expires'}: {format(new Date(doc.expiryDate), 'MMM d, yyyy')}
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
