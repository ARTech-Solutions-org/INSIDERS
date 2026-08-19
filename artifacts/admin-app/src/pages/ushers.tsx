import { useState } from "react";
import { useListUshers, useUpdateUsherStatus } from "@workspace/api-client-react";
import { Link } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, MoreVertical, Eye, CheckCircle, XCircle, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const getImageUrl = (key?: string | null) => {
  if (!key) return undefined;
  const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || '';
  return `${baseUrl}/api/uploads/read?key=${encodeURIComponent(key)}`;
};

export default function Ushers() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const { toast } = useToast();
  
  const { data, isLoading, refetch } = useListUshers({ 
    search: search || undefined,
    status: status || undefined 
  });
  
  const { mutate: updateStatus } = useUpdateUsherStatus({
    mutation: {
      onSuccess: () => {
        toast({ title: "Status updated successfully" });
        refetch();
      },
    },
  });

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const queryParams = new URLSearchParams();
      if (search) queryParams.append("search", search);
      if (status) queryParams.append("status", status);
      
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const url = `${baseUrl}/api/ushers/export?${queryParams.toString()}`;
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('artech_admin_token')}`
        }
      });
      
      if (!response.ok) throw new Error("Failed to export");
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `ushers_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
      toast({ title: "Export completed" });
    } catch (error) {
      toast({ title: "Export failed", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">Active</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">Pending</Badge>;
      case 'declined':
        return <Badge variant="destructive" className="bg-red-500/10 text-red-600 hover:bg-red-500/20">Declined</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Ushers</h1>
        <p className="text-muted-foreground">Manage your staff, approve new registrations, and view performance.</p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center flex-1 gap-2 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or phone..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
           <select 
             className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
             value={status}
             onChange={(e) => setStatus(e.target.value)}
           >
             <option value="">All Statuses</option>
             <option value="active">Active</option>
             <option value="pending">Pending</option>
             <option value="declined">Declined</option>
           </select>
           <Button variant="outline" size="sm" className="h-10 ml-2" onClick={handleExport} disabled={isExporting}>
             <Download className="w-4 h-4 mr-2" />
             Export Excel
           </Button>
        </div>
      </div>

      <div className="border rounded-md bg-card overflow-hidden flex-1 flex flex-col">
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur-sm z-10">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>National ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Loading ushers...
                  </TableCell>
                </TableRow>
              ) : data?.data?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No ushers found.
                  </TableCell>
                </TableRow>
              ) : (
                data?.data?.map((usher) => (
                  <TableRow key={usher.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={getImageUrl(usher.profilePhotoKey) || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {usher.fullName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="font-medium">{usher.fullName}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{usher.phone}</div>
                        <div className="text-xs text-muted-foreground">{usher.email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {usher.nationalIdNumber}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(usher.status || undefined)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-sm">{usher.avgRating?.toFixed(1) || 'N/A'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(usher.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <Link href={`/ushers/${usher.id}`}>
                            <DropdownMenuItem className="cursor-pointer">
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                          </Link>
                          <DropdownMenuSeparator />
                          {usher.status === 'pending' && (
                            <>
                              <DropdownMenuItem 
                                className="cursor-pointer text-green-600 focus:bg-green-50 focus:text-green-700"
                                onClick={() => updateStatus({ id: usher.id, data: { status: 'active' } })}
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700"
                                onClick={() => updateStatus({ id: usher.id, data: { status: 'declined' } })}
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Decline
                              </DropdownMenuItem>
                            </>
                          )}
                          {usher.status === 'active' && (
                            <DropdownMenuItem 
                              className="cursor-pointer text-amber-600 focus:bg-amber-50 focus:text-amber-700"
                              onClick={() => updateStatus({ id: usher.id, data: { status: 'pending' } })}
                            >
                              Suspend (Set Pending)
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="p-4 border-t border-border bg-muted/20 text-xs text-muted-foreground flex justify-between items-center">
          <span>Showing {data?.data?.length || 0} of {data?.total || 0} ushers</span>
        </div>
      </div>
    </div>
  );
}
