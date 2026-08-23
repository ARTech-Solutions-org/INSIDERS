import React, { useState } from 'react';
import { useListMyDocuments, useAddMyDocument, getListMyDocumentsQueryKey, useGetMyUsherProfile, useUpdateMyUsherProfile, getGetMyUsherProfileQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Calendar, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const uploadToR2 = async (file: File, type: string) => {
  const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || '';
  const res = await fetch(`${baseUrl}/api/uploads/presigned-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, contentType: file.type, type })
  });
  if (!res.ok) throw new Error('Failed to get upload URL');
  const { url, key } = await res.json();
  
  const uploadRes = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file
  });
  if (!uploadRes.ok) throw new Error('Failed to upload file');
  
  return { url: `${baseUrl}/api/uploads/read?key=${encodeURIComponent(key)}`, key };
};

export default function Documents() {
  const { data: documents, isLoading } = useListMyDocuments();
  const { data: profile } = useGetMyUsherProfile();
  const addMutation = useAddMyDocument();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [docType, setDocType] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [newFile, setNewFile] = useState<File | null>(null);
  const updateProfileMutation = useUpdateMyUsherProfile();

  const [idOpen, setIdOpen] = useState(false);
  const [idSide, setIdSide] = useState<'front' | 'back' | null>(null);
  const [idExpiry, setIdExpiry] = useState('');
  const [idFile, setIdFile] = useState<File | null>(null);
        queryClient.invalidateQueries({ queryKey: getListMyDocumentsQueryKey() });
  const handleAdd = async () => {
    if (!docType) {
      toast.error('Document type is required');
      return;
    }
    if (!newFile) {
      toast.error('Please select a file');
      return;
    }

    try {
      toast.loading('Uploading document...', { id: 'upload' });
      const res = await uploadToR2(newFile, 'document');
      toast.dismiss('upload');
      
      addMutation.mutate({
        data: {
          docType,
          fileUrl: res.url,
          fileKey: res.key,
          expiryDate: expiryDate ? new Date(expiryDate).toISOString() : undefined
        }
      }, {
        onSuccess: () => {
          toast.success('Document added');
          setOpen(false);
          setDocType('');
          setExpiryDate('');
          setNewFile(null);
          queryClient.invalidateQueries({ queryKey: getListMyDocumentsQueryKey() });
        },
        onError: (err) => toast.error(err.message || 'Failed to add document')
      });
    } catch (e) {
      toast.dismiss('upload');
      toast.error('Failed to upload document');
    }
  };

  const handleUploadIdSubmit = async () => {
    if (!idFile) {
      toast.error('Please select an image file');
      return;
    }
    if (!idExpiry) {
      toast.error('Expiration date is required');
      return;
    }

    try {
      toast.loading(`Uploading ID (${idSide})...`, { id: `upload-id-${idSide}` });
      const res = await uploadToR2(idFile, 'nationalId');
      
      const payload: any = {
        nationalIdExpiryDate: new Date(idExpiry).toISOString()
      };
      if (idSide === 'front') {
        payload.nationalIdDocUrl = res.url;
        payload.nationalIdDocKey = res.key;
      } else {
        payload.nationalIdDocBackUrl = res.url;
        payload.nationalIdDocBackKey = res.key;
      }

      await updateProfileMutation.mutateAsync({ data: payload });
      toast.success(`ID (${idSide}) updated successfully`);
      queryClient.invalidateQueries({ queryKey: getGetMyUsherProfileQueryKey() });
      setIdOpen(false);
      setIdFile(null);
      setIdExpiry('');
    } catch (e: any) {
      toast.error(e.response?.data?.error || `Failed to upload ID (${idSide})`);
    } finally {
      toast.dismiss(`upload-id-${idSide}`);
    }
  };

  const canReplaceId = () => {
    if (!profile?.nationalIdExpiryDate) return true;
    const expiry = new Date(profile.nationalIdExpiryDate);
    const now = new Date();
    const isExpired = now.getTime() > expiry.getTime();
    const isSameMonth = now.getFullYear() === expiry.getFullYear() && now.getMonth() === expiry.getMonth();
    return isExpired || isSameMonth;
  };

  const openIdDialog = (side: 'front' | 'back') => {
    if (profile?.nationalIdDocUrl && !canReplaceId()) {
      toast.error('National ID can only be replaced during the month of its expiration.');
      return;
    }
    setIdSide(side);
    setIdOpen(true);
  };
  const safeDocs = Array.isArray(documents) ? documents : [];

  const getImageUrl = (key?: string | null) => {
    if (!key) return undefined;
    const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || '';
    return `${baseUrl}/api/uploads/read?key=${encodeURIComponent(key)}`;
  };

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
                <label className="font-semibold text-xs text-foreground/90">Document File</label>
                <Input type="file" onChange={e => {
                  if (e.target.files && e.target.files[0]) {
                    setNewFile(e.target.files[0]);
                  }
                }} className="rounded-xl border-border h-11 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90" />
              </div>
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
      ) : safeDocs.length === 0 && !profile?.nationalIdDocUrl && !(profile as any)?.nationalIdDocBackUrl ? (
        <div className="border border-border/50 bg-card p-10 text-center mt-6 flex flex-col items-center justify-center relative overflow-hidden z-10 rounded-2xl shadow-sm">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3 relative z-10" />
          <p className="brand-meta text-foreground/60 relative z-10 mb-1">NO DOCUMENTS UPLOADED</p>
          <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest relative z-10">ADD YOUR ID AND CERTIFICATES</p>
        </div>
      ) : (
        <div className="space-y-3 pb-safe relative z-10">
          <div className="bg-card border border-border rounded-2xl p-4 flex flex-col shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 border rounded-full flex items-center justify-center bg-primary/5 text-primary border-primary/20">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold tracking-wide uppercase">National ID (Front)</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="brand-meta px-2 py-1 border rounded-md bg-secondary/10 text-secondary border-secondary/20">
                      {profile?.nationalIdDocUrl ? 'UPLOADED' : 'REQUIRED'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="relative">
                <Button size="sm" variant="outline" className="text-[10px] tracking-widest uppercase" onClick={() => openIdDialog('front')}>
                  {profile?.nationalIdDocUrl ? 'REPLACE' : 'UPLOAD'}
                </Button>
              </div>
            </div>
            {profile?.nationalIdDocUrl && (
              <div className="w-full h-40 bg-muted rounded-xl overflow-hidden mt-2 relative">
                <img src={profile.nationalIdDocKey ? getImageUrl(profile.nationalIdDocKey) : profile.nationalIdDocUrl} alt="ID Front" className="w-full h-full object-cover" />
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 flex flex-col shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 border rounded-full flex items-center justify-center bg-primary/5 text-primary border-primary/20">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold tracking-wide uppercase">National ID (Back)</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="brand-meta px-2 py-1 border rounded-md bg-secondary/10 text-secondary border-secondary/20">
                      {(profile as any)?.nationalIdDocBackUrl ? 'UPLOADED' : 'REQUIRED'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="relative">
                <Button size="sm" variant="outline" className="text-[10px] tracking-widest uppercase" onClick={() => openIdDialog('back')}>
                  {(profile as any)?.nationalIdDocBackUrl ? 'REPLACE' : 'UPLOAD'}
                </Button>
              </div>
            </div>
            {(profile as any)?.nationalIdDocBackUrl && (
              <div className="w-full h-40 bg-muted rounded-xl overflow-hidden mt-2 relative">
                <img src={(profile as any).nationalIdDocBackKey ? getImageUrl((profile as any).nationalIdDocBackKey) : (profile as any).nationalIdDocBackUrl} alt="ID Back" className="w-full h-full object-cover" />
              </div>
            )}
          </div>

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

      <Dialog open={idOpen} onOpenChange={setIdOpen}>
        <DialogContent className="w-[90vw] max-w-[400px] rounded-2xl border border-border p-6 bg-card shadow-lg">
          <DialogHeader>
            <DialogTitle className="brand-display text-2xl uppercase tracking-wide">
              UPLOAD ID ({idSide === 'front' ? 'FRONT' : 'BACK'})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-4">
            <div className="space-y-2">
              <label className="font-semibold text-xs text-foreground/90">ID Photo</label>
              <Input type="file" accept="image/*" onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  setIdFile(e.target.files[0]);
                }
              }} className="rounded-xl border-border h-11 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90" />
            </div>

            <div className="space-y-2">
              <label className="font-semibold text-xs text-foreground/90">Expiration Date</label>
              <Input
                type="date"
                value={idExpiry}
                onChange={e => setIdExpiry(e.target.value)}
                className="rounded-xl border-border h-11"
              />
            </div>

            <Button className="w-full rounded-xl h-11 text-xs font-bold tracking-widest uppercase mt-4 shadow-sm" onClick={handleUploadIdSubmit} disabled={updateProfileMutation.isPending}>
              {updateProfileMutation.isPending ? 'UPLOADING...' : 'SAVE ID'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
