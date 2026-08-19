import { useRoute, Link } from "wouter";
import { 
  useGetUsher, 
  useUpdateUsherStatus,
  useGetUsherStats,
  useListUsherDocuments,
  getGetUsherQueryKey,
  getListUshersQueryKey,
  getListUsherDocumentsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  ArrowLeft, 
  User, 
  Phone, 
  Mail, 
  CreditCard, 
  Star, 
  CheckCircle, 
  XCircle, 
  Calendar, 
  ShieldAlert,
  Loader2,
  Clock,
  Award,
  FileText,
  Briefcase,
  TrendingUp,
  AlertCircle,
  Banknote
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const getImageUrl = (key?: string | null) => {
  if (!key) return undefined;
  const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || '';
  return `${baseUrl}/api/uploads/read?key=${encodeURIComponent(key)}`;
};

export default function UsherDetails() {
  const [, params] = useRoute("/ushers/:id");
  const usherId = params?.id ? parseInt(params.id, 10) : 0;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: usher, isLoading, isError } = useGetUsher(usherId, {
    query: { enabled: !!usherId, queryKey: getGetUsherQueryKey(usherId) as any }
  });

  const { data: stats } = useGetUsherStats(usherId);
  const { data: documents } = useListUsherDocuments(usherId, {
    query: { 
      enabled: !!usherId,
      queryKey: getListUsherDocumentsQueryKey(usherId) as any
    }
  });

  const { mutate: updateStatus, isPending: isUpdating } = useUpdateUsherStatus({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetUsherQueryKey(usherId) as any });
        queryClient.invalidateQueries({ queryKey: getListUshersQueryKey() as any });
        toast({ title: "Usher status updated" });
      },
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: "Update Failed",
          description: err.message || "Failed to update status",
        });
      }
    }
  });

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-200">Active</Badge>;
      case "pending":
        return <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-200">Pending</Badge>;
      case "declined":
        return <Badge className="bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-200">Declined</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError || !usher) {
    return (
      <div className="p-8 text-center space-y-4">
        <ShieldAlert className="w-12 h-12 text-destructive mx-auto" />
        <h2 className="text-xl font-bold">Usher Not Found</h2>
        <p className="text-muted-foreground text-sm">The usher profile you requested does not exist or has been removed.</p>
        <Link href="/ushers">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Ushers
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between">
        <Link href="/ushers">
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Ushers
          </Button>
        </Link>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {usher.status === "pending" && (
            <>
              <Button 
                size="sm" 
                className="bg-green-600 hover:bg-green-700 text-white" 
                disabled={isUpdating}
                onClick={() => updateStatus({ id: usher.id, data: { status: "active" } })}
              >
                {isUpdating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                Approve
              </Button>
              <Button 
                size="sm" 
                variant="destructive"
                disabled={isUpdating}
                onClick={() => updateStatus({ id: usher.id, data: { status: "declined" } })}
              >
                {isUpdating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <XCircle className="w-4 h-4 mr-1" />}
                Decline
              </Button>
            </>
          )}
          {usher.status === "active" && (
            <Button 
              size="sm" 
              variant="outline" 
              className="text-amber-600 border-amber-300 hover:bg-amber-50"
              disabled={isUpdating}
              onClick={() => updateStatus({ id: usher.id, data: { status: "pending" } })}
            >
              Suspend (Set Pending)
            </Button>
          )}
          {usher.status === "declined" && (
            <Button 
              size="sm" 
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={isUpdating}
              onClick={() => updateStatus({ id: usher.id, data: { status: "active" } })}
            >
              Re-Approve
            </Button>
          )}
        </div>
      </div>

      {/* Header Profile Summary */}
      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <Avatar className="w-24 h-24 border-4 border-background shadow-md">
              <AvatarImage src={getImageUrl(usher.profilePhotoKey) || undefined} />
              <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                {usher.fullName?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>

            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">{usher.fullName}</h1>
                {getStatusBadge(usher.status || undefined)}
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Registered {format(new Date(usher.createdAt), "MMMM d, yyyy")}
              </p>
            </div>

            <div className="flex sm:flex-col gap-4 text-left sm:text-right border-t sm:border-t-0 sm:border-l border-border pt-4 sm:pt-0 sm:pl-6 w-full sm:w-auto justify-between">
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider block font-semibold">Rating</span>
                <span className="text-xl font-bold flex items-center sm:justify-end gap-1">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  {usher.avgRating?.toFixed(1) || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider block font-semibold">Balance</span>
                <span className="text-xl font-bold text-primary">
                  EGP {usher.balance?.toLocaleString() || 0}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex flex-col items-start">
            <div className="w-9 h-9 rounded-full bg-green-500/10 flex items-center justify-center mb-2">
              <Briefcase className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Jobs Done</span>
            <span className="text-2xl font-bold mt-0.5">{(stats as any)?.jobsCompleted ?? '—'}</span>
            <span className="text-[10px] text-muted-foreground mt-1">of {(stats as any)?.totalAssigned ?? 0} assigned</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-start">
            <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center mb-2">
              <Star className="w-4 h-4 text-amber-500" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Avg Rating</span>
            <span className="text-2xl font-bold mt-0.5">{typeof (stats as any)?.avgRating === 'number' ? (stats as any).avgRating.toFixed(1) : '—'}</span>
            <span className="text-[10px] text-muted-foreground mt-1">{(stats as any)?.ratingCount ?? 0} rating(s)</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-start">
            <div className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center mb-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">No-Shows</span>
            <span className="text-2xl font-bold mt-0.5">{(stats as any)?.noShowCount ?? '—'}</span>
            <span className="text-[10px] text-muted-foreground mt-1">{(stats as any)?.cancelCount ?? 0} cancels</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-start">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Banknote className="w-4 h-4 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Earned</span>
            <span className="text-2xl font-bold mt-0.5">EGP {((stats as any)?.totalEarned ?? 0).toLocaleString()}</span>
            <span className="text-[10px] text-muted-foreground mt-1">lifetime credits</span>
          </CardContent>
        </Card>
      </div>

      {/* Profile Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact & Personal Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-primary" /> Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium">{usher.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Phone Number</p>
                <p className="font-medium">{usher.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CreditCard className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">National ID Number</p>
                <p className="font-medium">{usher.nationalIdNumber}</p>
              </div>
            </div>
            {usher.paymentMethod && (
              <div className="flex items-center gap-3 text-sm">
                <Banknote className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Payment Method</p>
                  <p className="font-medium uppercase">{usher.paymentMethod}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 break-all">{usher.paymentMethodDetails}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* National ID Document */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" /> National ID Document
            </CardTitle>
            <CardDescription>Verification document submitted during registration.</CardDescription>
          </CardHeader>
          <CardContent>
            {usher.nationalIdDocKey ? (
              <div className="space-y-6">
                <div className="flex flex-col gap-3">
                  <h3 className="font-semibold text-sm">ID Front</h3>
                  <a href={getImageUrl(usher.nationalIdDocKey)} target="_blank" rel="noopener noreferrer" className="block w-fit">
                    <img src={getImageUrl(usher.nationalIdDocKey)} alt="ID Front" className="w-full max-w-sm rounded-lg border shadow-sm hover:opacity-90 transition-opacity" />
                  </a>
                </div>
                {usher.nationalIdDocBackKey && (
                  <div className="flex flex-col gap-3 pt-4 border-t border-border">
                    <h3 className="font-semibold text-sm">ID Back</h3>
                    <a href={getImageUrl(usher.nationalIdDocBackKey)} target="_blank" rel="noopener noreferrer" className="block w-fit">
                      <img src={getImageUrl(usher.nationalIdDocBackKey)} alt="ID Back" className="w-full max-w-sm rounded-lg border shadow-sm hover:opacity-90 transition-opacity" />
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No National ID document uploaded.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Additional Documents */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" /> Additional Documents
            </CardTitle>
            <CardDescription>Extra documents uploaded by the usher.</CardDescription>
          </CardHeader>
          <CardContent>
            {!documents || documents.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No additional documents uploaded.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {documents.map((doc) => (
                  <div key={doc.id} className="border rounded-xl p-4 flex flex-col gap-3 shadow-sm bg-card hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col">
                        <span className="font-semibold">{doc.docType}</span>
                        {doc.expiryDate && (
                          <span className="text-xs text-muted-foreground mt-1">
                            Expires: {format(new Date(doc.expiryDate), "MMM d, yyyy")}
                          </span>
                        )}
                        <span className={`text-[10px] uppercase font-bold tracking-wider mt-2 px-2 py-0.5 rounded-full w-fit ${doc.status === 'approved' ? 'bg-green-100 text-green-700' : doc.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-secondary/20 text-secondary-foreground'}`}>
                          {doc.status}
                        </span>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                    </div>
                    {doc.fileKey || doc.fileUrl ? (
                      <a 
                        href={doc.fileKey ? getImageUrl(doc.fileKey) : doc.fileUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="mt-2 text-sm text-primary hover:underline font-medium inline-flex items-center gap-1"
                      >
                        View Document
                      </a>
                    ) : (
                      <span className="mt-2 text-sm text-muted-foreground italic">No file attached</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
