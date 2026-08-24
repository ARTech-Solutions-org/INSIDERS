import { useListAuditLog } from "@workspace/api-client-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { ShieldAlert, User, Activity } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export default function AuditLog() {
  const [adminName, setAdminName] = useState("");
  const { data, isLoading } = useListAuditLog(
    { adminName: adminName ? adminName : undefined },
    { query: { enabled: true } as any }
  );

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ShieldAlert className="w-8 h-8 text-primary" />
          Audit Log
        </h1>
        <p className="text-muted-foreground">View all actions performed by administrators in the system.</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative max-w-xs w-full">
          <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Filter by Admin Name..."
            className="pl-8"
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            type="text"
          />
        </div>
      </div>

      <div className="border rounded-md bg-card overflow-hidden flex-1 flex flex-col">
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur-sm z-10">
              <TableRow>
                <TableHead className="w-[180px]">Timestamp</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead className="max-w-[300px]">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Loading audit logs...
                  </TableCell>
                </TableRow>
              ) : data?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No audit logs found.
                  </TableCell>
                </TableRow>
              ) : (
                data?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                      {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm:ss')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                           <span className="text-xs font-medium text-primary">
                             {log.adminName?.charAt(0) || '?'}
                           </span>
                        </div>
                        <span className="font-medium text-sm">{log.adminName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <Activity className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium capitalize text-foreground">
                          {log.actionType.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col">
                        <span className="font-medium">{log.targetName || log.targetTable}</span>
                        <span className="text-xs text-muted-foreground">
                          {log.targetName ? log.targetTable : ''} <span className="font-mono">#{log.targetId}</span>
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate" title={log.details || ''}>
                      {log.details ? (
                         (() => {
                           try {
                             const parsed = JSON.parse(log.details);
                             return parsed.message || log.details;
                           } catch { return log.details; }
                         })()
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
