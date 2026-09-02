import { useState, useEffect, useRef } from "react";
import { useRoute, Link } from "wouter";
// @ts-ignore

import * as XLSX from "xlsx";
import { 
  useGetEvent, 
  useGetSmartCandidates, 
  useAssignUsherToEvent,
  useRemoveAssignment,
  useUpdateEvent,
  useListEventTeams,
  useCreateEventTeam,
  useDeleteEventTeam,
  useGetTeamLeaderSuggestions,
  useUpdateAssignment,
  useSmartAssignBatch,
  getGetEventQueryKey,
  getListEventsQueryKey,
  getGetTeamLeaderSuggestionsQueryKey,

  useGetEventFeedbackLink,
  useCreateEventFeedbackLink,
  getGetEventFeedbackLinkQueryKey,
  useAdminCheckout,
  useCreateDeductionRule,
  useDeleteDeductionRule,
  useAdminAddManualDeduction,
  useAdminRemoveManualDeduction,
} from "@workspace/api-client-react";
import { useQueryClient, useQueries } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  MapPin, 
  Calendar, 
  Clock, 
  Users, 
  Star,
  CheckCircle,
  XCircle,
  UserPlus,
  UserMinus,
  Edit,
  Globe,
  Loader2,
  ArrowLeft,
  Shield,
  Crown,
  Trash2,
  UserCog,
  X,
  Link as LinkIcon,
  Copy,
  RefreshCw,
  MessageSquare,
  LogOut,
  MinusCircle,
  Camera,
  Ruler,
  Shirt,
  FileText,
  TableIcon
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { LocationPicker } from "@/components/ui/location-picker";

function AssignmentPayInput({ assignment, updateAssignment, eventId }: { assignment: any, updateAssignment: any, eventId: number }) {
  const [val, setVal] = useState(assignment.overriddenPay ?? "");

  // Sync with external updates
  useEffect(() => {
    setVal(assignment.overriddenPay ?? "");
  }, [assignment.overriddenPay]);

  const handleBlur = () => {
    const newVal = val === "" ? null : parseInt(val as string, 10);
    if (!isNaN(newVal as any) && newVal !== (assignment.overriddenPay ?? null)) {
      updateAssignment({ 
        id: eventId, 
        assignmentId: assignment.id, 
        data: { 
          usherId: assignment.usherId,
          overriddenPay: newVal 
        } 
      });
    }
  };

  return (
    <Input
      type="number"
      className="h-6 w-16 text-xs px-1.5 py-0 bg-muted/20"
      placeholder="Pay"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}

const getImageUrl = (key?: string | null) => {
  if (!key) return undefined;
  const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || '';
  return `${baseUrl}/api/uploads/read?key=${encodeURIComponent(key)}`;
};

export default function EventDetails() {
  const [, params] = useRoute("/events/:id");
  const eventId = params?.id ? parseInt(params.id, 10) : 0;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: user } = useGetMe();
  const isSuperAdmin = user?.role === "super_admin";

  const { data: event, isLoading: isEventLoading, refetch } = useGetEvent(
    eventId,
    { query: { enabled: !!eventId, queryKey: getGetEventQueryKey(eventId) as any } as any }
  );

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingSalary, setIsExportingSalary] = useState(false);
  const [ratingAssignment, setRatingAssignment] = useState<any>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState("");

  const pdfRef = useRef<HTMLDivElement>(null);

  const isFieldLocked = (fieldName: string) => {
    if (isSuperAdmin) return false;
    return event?.superAdminLockedFields?.includes(fieldName) ?? false;
  };
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  // PDF Data calculations
  const ACTIVE_STATUSES = ['assigned', 'accepted', 'checked_in', 'completed'];
  const pdfAssignedUshers = event?.assignments?.filter((a: any) =>
    ACTIVE_STATUSES.includes(a.status)
  ) || [];

  const getCountsForPDF = (key: string) => {
    return Object.entries(
      pdfAssignedUshers.reduce((acc: any, assignment: any) => {
        const val = assignment.usher?.[key];
        if (val) acc[val] = (acc[val] || 0) + 1;
        return acc;
      }, {})
    ).sort((a: any, b: any) => (b[1] as number) - (a[1] as number)) as [string, number][];
  };

  const pdfSizeCategories = [
    { label: 'T-Shirts', key: 'tShirtSize' },
    { label: 'Shirts', key: 'shirtSize' },
    { label: 'Pants', key: 'pantsSize' },
    { label: 'Shorts', key: 'shortsSize' },
    { label: 'Dresses', key: 'dressSize' },
    { label: 'Shoes', key: 'shoeSize' },
  ];

  // Filters for Pending Applicants
  const [filterGender, setFilterGender] = useState<string>('all');
  const [filterLanguage, setFilterLanguage] = useState<string>('all');
  const [filterMinRating, setFilterMinRating] = useState<string>('');
  const [filterMinHeight, setFilterMinHeight] = useState<string>('');
  const [filterDressSize, setFilterDressSize] = useState<string>('all');
  const [filterShoeSize, setFilterShoeSize] = useState<string>('all');

  // ─── DEDUCTION RULES ─────────────────────────────────────────────────────
  const [newRuleType, setNewRuleType] = useState('');
  const [newRuleAmount, setNewRuleAmount] = useState('');
  const [newRuleTrigger, setNewRuleTrigger] = useState('always');
  const [newRuleThreshold, setNewRuleThreshold] = useState('');

  const [manualDeductionAssignment, setManualDeductionAssignment] = useState<any>(null);
  const [checkinDetailsAssignment, setCheckinDetailsAssignment] = useState<any>(null);
  const [manualDeductionReason, setManualDeductionReason] = useState('');
  const [manualDeductionAmount, setManualDeductionAmount] = useState('');

  const { mutate: addManualDeduction, isPending: isAddingManualDeduction } = useAdminAddManualDeduction({
    mutation: {
      onSuccess: () => {
        toast({ title: "Manual deduction added successfully." });
        setManualDeductionAssignment(null);
        setManualDeductionReason('');
        setManualDeductionAmount('');
        refetch();
      },
      onError: (err: any) => {
        toast({ title: "Failed to add manual deduction.", description: err.response?.data?.error || err.message, variant: "destructive" });
      }
    }
  });

  const { mutate: removeManualDeduction } = useAdminRemoveManualDeduction({
    mutation: {
      onSuccess: () => {
        toast({ title: "Manual deduction removed successfully." });
        refetch();
      },
      onError: (err: any) => {
        toast({ title: "Failed to remove manual deduction.", description: err.response?.data?.error || err.message, variant: "destructive" });
      }
    }
  });

  // ─── FEEDBACK LINK ───────────────────────────────────────────────────────
  const { data: feedbackLink, isLoading: isFeedbackLinkLoading } = useGetEventFeedbackLink(
    eventId,
    { query: { enabled: !!eventId, retry: false, queryKey: getGetEventFeedbackLinkQueryKey(eventId) as any } as any }
  );
  
  const createFeedbackLinkMutation = useCreateEventFeedbackLink({
    mutation: {
      onSuccess: () => {
        toast({ title: "Feedback link generated successfully." });
        queryClient.invalidateQueries({ queryKey: getGetEventFeedbackLinkQueryKey(eventId) as any });
      },
      onError: (err: any) => {
        toast({ title: "Failed to generate link.", description: err.response?.data?.error || err.message, variant: "destructive" });
      }
    }
  });

  const handleCopyFeedbackLink = () => {
    if (!feedbackLink) return;
    const url = `${window.location.origin}/feedback/${feedbackLink.token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied to clipboard." });
  };

  
  const totalSpent = (event?.assignments || []).reduce((acc: number, a: any) => {
    if (!['assigned', 'accepted', 'checked_in', 'completed'].includes(a.status)) return acc;
    const baseRate = a.role === 'leader' || a.isTeamLead ? (event?.leaderRate || 0) : (event?.regularRate || 0);
    const pay = a.overriddenPay != null ? Number(a.overriddenPay) : baseRate;
    return acc + pay;
  }, 0);
  
  const isBudgetExceeded = event?.budget && totalSpent > event.budget;

  const { mutate: adminCheckout, isPending: isAdminCheckingOut } = useAdminCheckout({
    mutation: {
      onSuccess: () => {
        toast({ title: "Checked out successfully." });
        refetch();
      },
      onError: (err: any) => {
        toast({ title: "Failed to checkout.", description: err.response?.data?.error || err.message, variant: "destructive" });
      }
    }
  });

  const { mutate: createDeductionRule, isPending: isCreatingRule } = useCreateDeductionRule({
    mutation: {
      onSuccess: () => {
        setNewRuleType('');
        setNewRuleAmount('');
        queryClient.invalidateQueries({ queryKey: getGetEventQueryKey(eventId) as any });
      },
      onError: (err: any) => {
        toast({ title: "Failed to add rule.", description: err.response?.data?.error || err.message, variant: "destructive" });
      }
    }
  });

  const { mutate: deleteDeductionRule } = useDeleteDeductionRule({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetEventQueryKey(eventId) as any });
      },
      onError: (err: any) => {
        toast({ title: "Failed to delete rule.", description: err.response?.data?.error || err.message, variant: "destructive" });
      }
    }
  });

  const handleOpenRating = (assignment: any) => {
    setRatingAssignment(assignment);
    setRatingValue(5);
    setRatingComment("");
  };

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratingAssignment) return;
    setIsSubmittingRating(true);

    try {
      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("artech_admin_token")}`
        },
        body: JSON.stringify({
          eventAssignmentId: ratingAssignment.id,
          ratedByType: "admin",
          ratingValue,
          comment: ratingComment || undefined
        })
      });

      if (!res.ok) {
        let errorData: any = {};
        try {
          errorData = await res.json();
        } catch (e) {
          errorData = { error: `Server returned status ${res.status}` };
        }
        throw new Error(errorData.error || "Failed to submit rating");
      }

      toast({ title: "Usher rated successfully!" });
      setRatingAssignment(null);
      refetch();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Rating Failed",
        description: err.message || "Failed to submit rating",
      });
    } finally {
      setIsSubmittingRating(false);
    }
  };



  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamInstructions, setNewTeamInstructions] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  const { data: teams, refetch: refetchTeams } = useListEventTeams(eventId, { query: { enabled: !!eventId } as any });
  
  const { mutate: createTeam, isPending: isCreatingTeam } = useCreateEventTeam({
    mutation: {
      onSuccess: () => {
        toast({ title: "Team created!" });
        setNewTeamName("");
        setNewTeamInstructions("");
        refetchTeams();
      }
    }
  });

  const { mutate: deleteTeam } = useDeleteEventTeam({
    mutation: {
      onSuccess: () => {
        toast({ title: "Team deleted!" });
        if (selectedTeamId !== null) setSelectedTeamId(null);
        refetchTeams();
        refetch(); // to refresh assignments
      }
    }
  });

  const { data: leaderSuggestions } = useGetTeamLeaderSuggestions(eventId, selectedTeamId || 0, {
    query: { enabled: !!eventId && !!selectedTeamId } as any
  });

  const { mutate: updateAssignment } = useUpdateAssignment({
    mutation: {
      onSuccess: () => {
        toast({ title: "Assignment updated!" });
        refetch();
        if (selectedTeamId) {
          queryClient.invalidateQueries({ queryKey: getGetTeamLeaderSuggestionsQueryKey(eventId, selectedTeamId) as any });
        }
      }
    }
  });

  const { data: candidates, isLoading: isCandidatesLoading } = useGetSmartCandidates(
    eventId,
    undefined,
    { query: { enabled: !!eventId } as any }
  );

  const { mutate: assignUsher } = useAssignUsherToEvent({
    mutation: {
      onSuccess: () => {
        toast({ title: "Usher assigned successfully!" });
        refetch();
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Error assigning usher", description: err.response?.data?.error || err.message });
      },
    },
  });

  const { mutate: removeUsher } = useRemoveAssignment({
    mutation: {
      onSuccess: () => {
        toast({ title: "Usher removed successfully!" });
        refetch();
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Error removing usher", description: err.response?.data?.error || err.message });
      },
    },
  });

  const [isAutoAssignOpen, setIsAutoAssignOpen] = useState(false);
  const [autoAssignFilters, setAutoAssignFilters] = useState<any>({
    count: 5,
    gender: "",
    minRating: 0,
    minCompletedEvents: 0,
    requiresLeadershipExp: false,
    maxDistanceMeters: 0,
  });

  const { mutate: autoAssign, isPending: isAutoAssigning } = useSmartAssignBatch({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetEventQueryKey(eventId) as any });
        setIsAutoAssignOpen(false);
      }
    }
  });

  const { mutate: updateEvent, isPending: isUpdating } = useUpdateEvent({
    mutation: {
      onSuccess: () => {
        toast({ title: "Event updated successfully!" });
        queryClient.invalidateQueries({ queryKey: getGetEventQueryKey(eventId) as any });
        queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() as any });
        setIsEditDialogOpen(false);
        refetch();
      },
      onError: (err: any) => {
        toast({ 
          variant: "destructive", 
          title: "Update Failed", 
          description: err.response?.data?.error || err.message || "Failed to update event" 
        });
      }
    }
  });

  // Edit form state
  const [formData, setFormData] = useState({
    title: "",
    eventLocName: "",
    venueLat: "",
    venueLng: "",
    checkinRadiusM: "100",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    dressCode: "",
    instructions: "",
    budget: "",
    leaderRate: "",
    regularRate: "",
  });

  useEffect(() => {
    if (event) {
      const start = new Date(event.startTime);
      const end = new Date(event.endTime);
      
      setFormData({
        title: event.title || "",
        eventLocName: event.eventLocName || "",
        venueLat: event.venueLat ? String(event.venueLat) : "",
        venueLng: event.venueLng ? String(event.venueLng) : "",
        checkinRadiusM: event.checkinRadiusM ? String(event.checkinRadiusM) : "100",
        startDate: format(start, "yyyy-MM-dd"),
        startTime: format(start, "HH:mm"),
        endDate: format(end, "yyyy-MM-dd"),
        endTime: format(end, "HH:mm"),
        dressCode: event.dressCode || "",
        instructions: event.instructions || "",
        budget: event.budget ? String(event.budget) : "",
          leaderRate: event.leaderRate ? String(event.leaderRate) : "",
          regularRate: event.regularRate ? String(event.regularRate) : "",
      });
    }
  }, [event]);

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const startDateTime = new Date(`${formData.startDate}T${formData.startTime || '00:00'}`);
    const endDateTime = new Date(`${formData.endDate}T${formData.endTime || '00:00'}`);

    if (endDateTime <= startDateTime) {
      toast({
        variant: "destructive",
        title: "Invalid Schedule",
        description: "Event end time must be after the start time.",
      });
      return;
    }

    updateEvent({
      id: eventId,
      data: {
        title: formData.title,
        eventLocName: formData.eventLocName,
        venueLat: formData.venueLat ? parseFloat(formData.venueLat) : undefined,
        venueLng: formData.venueLng ? parseFloat(formData.venueLng) : undefined,
        checkinRadiusM: formData.checkinRadiusM ? parseInt(formData.checkinRadiusM, 10) : 100,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        dressCode: formData.dressCode || undefined,
        instructions: formData.instructions || undefined,
        budget: isSuperAdmin && formData.budget ? parseFloat(formData.budget) : undefined,
          leaderRate: formData.leaderRate ? parseFloat(formData.leaderRate) : undefined,
          regularRate: formData.regularRate ? parseFloat(formData.regularRate) : undefined,
        version: event?.version
      }
    });
  };

  const handlePublishToggle = () => {
    if (user?.role !== "super_admin") {
      toast({ title: "Forbidden", description: "Only Super Admins can publish events.", variant: "destructive" });
      return;
    }
    const newStatus = event?.status === "published" ? "draft" : "published";
    updateEvent({
      id: eventId,
      data: { status: newStatus as any, version: event?.version }
    });
  };

    const handleExportPDF = async () => {
    if (!pdfRef.current) return;
    setIsExportingPDF(true);
    try {
      const element = pdfRef.current;
      const opt = {
        margin:       10,
        filename:     `Ushers-${event?.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'Event'}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, allowTaint: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      
      const html2pdfModule = await import('html2pdf.js');
      const pdfGenerator = html2pdfModule.default || html2pdfModule;
      
      await pdfGenerator().set(opt).from(element).save();

      toast({ title: "PDF exported successfully!" });
    } catch (error: any) {
      console.error(error);
      toast({ title: "Export failed", description: String(error?.message || error), variant: "destructive" });
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportSalarySheet = async () => {
    setIsExportingSalary(true);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Salary Sheet');

      const SALARY_ACTIVE_STATUSES = ['checked_in', 'completed'];
      const assignedUshers = (event?.assignments || []).filter((a: any) =>
        SALARY_ACTIVE_STATUSES.includes(a.status)
      );
      const supervisors = assignedUshers.filter((a: any) => a.isTeamLead);
      const regulars = assignedUshers.filter((a: any) => !a.isTeamLead);

      const leaderRate = event?.leaderRate || 0;
      const regularRate = event?.regularRate || 0;
      const globalDeductionTotal = (event?.deductionRules || []).reduce((s: number, r: any) => s + r.amount, 0);

      // Colors
      const NAVY = '00003087';
      const NAVY_TEXT = 'FFFFFFFF';
      const TEAL = 'FF0070C0';
      const ALT_ROW = 'FFD6E4F0';
      const WHITE = 'FFFFFFFF';

      const navyStyle: any = {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } },
        font: { bold: true, color: { argb: NAVY_TEXT }, size: 12 },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } },
        }
      };

      const applyNavyRow = (row: any) => {
        row.height = 20;
        row.eachCell({ includeEmpty: true }, (cell: any) => {
          cell.style = { ...navyStyle };
        });
      };

      // Col widths
      sheet.columns = [
        { key: 'A', width: 32 },
        { key: 'B', width: 10 },
        { key: 'C', width: 14 },
        { key: 'D', width: 14 },
        { key: 'E', width: 14 },
        { key: 'F', width: 14 },
      ];

      // ─── ROW 1: Event Name (merged) ───────────────────────────────────
      const titleRow = sheet.addRow([event?.title || 'Event', '', '', '', '', '']);
      sheet.mergeCells(`A1:F1`);
      applyNavyRow(titleRow);
      titleRow.getCell(1).font = { bold: true, color: { argb: NAVY_TEXT }, size: 14 };

      // ─── ROW 2: Headers ────────────────────────────────────────────────
      const headerRow = sheet.addRow(['Item', '# Days', 'Salary', 'Deduction', 'Subtotal', 'Total']);
      applyNavyRow(headerRow);

      // ─── ROW 3: Supervisors header ─────────────────────────────────────
      const supHeaderRow = sheet.addRow(['Supervisors', '', '', '', '', null]);
      sheet.mergeCells(`A3:E3`);
      applyNavyRow(supHeaderRow);
      const supTotalCell = supHeaderRow.getCell(6);
      supTotalCell.style = { ...navyStyle } as any;

      // ─── Supervisor data rows ──────────────────────────────────────────
      const supDataStart = 4;
      const supRows: any[] = [];
      for (const assignment of supervisors) {
        const usher = assignment.usher;
        const overridden = assignment.overriddenPay;
        const salary = overridden !== null && overridden !== undefined ? overridden : leaderRate;
        const manualDed = ((assignment as any).manualDeductions || []).reduce((s: number, d: any) => s + d.amount, 0);
        const deduction = globalDeductionTotal + manualDed;
        const subtotal = salary - deduction;
        supRows.push([usher?.fullName || '', 1, salary, deduction, subtotal, '']);
      }
      // Pad to min 4 rows
      while (supRows.length < 4) supRows.push(['', 1, '', '', 0, '']);

      supRows.forEach((rowData, i) => {
        const r = sheet.addRow(rowData);
        r.height = 18;
        const isAlt = i % 2 === 1;
        const bg = isAlt ? ALT_ROW : WHITE;
        r.eachCell({ includeEmpty: true }, (cell) => {
          cell.style = {
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } } as any,
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: {
              top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
              bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
              left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
              right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
            }
          } as any;
        });
        // Name left aligned
        r.getCell(1).style = { ...r.getCell(1).style, alignment: { horizontal: 'left', vertical: 'middle' } } as any;
        // # Days teal
        r.getCell(2).font = { bold: true, color: { argb: TEAL } };
        // Subtotal bold
        r.getCell(5).font = { bold: true };
      });

      const supDataEnd = 3 + supRows.length;

      // Calculate supervisor total from actual data
      const supTotal = supervisors.reduce((sum: number, a: any) => {
        const overridden = a.overriddenPay;
        const salary = overridden !== null && overridden !== undefined ? overridden : leaderRate;
        const manualDed = ((a as any).manualDeductions || []).reduce((s: number, d: any) => s + d.amount, 0);
        return sum + (salary - (globalDeductionTotal + manualDed));
      }, 0);
      supHeaderRow.getCell(6).value = { formula: `SUM(E${supDataStart}:E${supDataEnd})`, result: supTotal } as any;
      supHeaderRow.getCell(6).numFmt = '#,##0';

      // ─── ROW: Ushers header ────────────────────────────────────────────
      const usherHeaderRowNum = supDataEnd + 1;
      const ushHeaderRow = sheet.addRow(['Ushers', '', '', '', '', null]);
      const usherMergeEnd = `E${usherHeaderRowNum}`;
      sheet.mergeCells(`A${usherHeaderRowNum}:${usherMergeEnd}`);
      applyNavyRow(ushHeaderRow);
      const ushTotalCell = ushHeaderRow.getCell(6);
      ushTotalCell.style = { ...navyStyle } as any;

      // ─── Usher data rows ───────────────────────────────────────────────
      const usherDataStart = usherHeaderRowNum + 1;
      const usherRows: any[] = [];
      for (const assignment of regulars) {
        const usher = assignment.usher;
        const overridden = assignment.overriddenPay;
        const salary = overridden !== null && overridden !== undefined ? overridden : regularRate;
        const manualDed = ((assignment as any).manualDeductions || []).reduce((s: number, d: any) => s + d.amount, 0);
        const deduction = globalDeductionTotal + manualDed;
        const subtotal = salary - deduction;
        usherRows.push([usher?.fullName || '', 1, salary, deduction, subtotal, '']);
      }
      while (usherRows.length < 4) usherRows.push(['', 1, '', '', 0, '']);

      usherRows.forEach((rowData, i) => {
        const r = sheet.addRow(rowData);
        r.height = 18;
        const isAlt = i % 2 === 1;
        const bg = isAlt ? ALT_ROW : WHITE;
        r.eachCell({ includeEmpty: true }, (cell) => {
          cell.style = {
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } } as any,
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: {
              top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
              bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
              left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
              right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
            }
          } as any;
        });
        r.getCell(1).style = { ...r.getCell(1).style, alignment: { horizontal: 'left', vertical: 'middle' } } as any;
        r.getCell(2).font = { bold: true, color: { argb: TEAL } };
        r.getCell(5).font = { bold: true };
      });

      const usherDataEnd = usherHeaderRowNum + usherRows.length;

      // Calculate usher total from actual data
      const ushTotal = regulars.reduce((sum: number, a: any) => {
        const overridden = a.overriddenPay;
        const salary = overridden !== null && overridden !== undefined ? overridden : regularRate;
        const manualDed = ((a as any).manualDeductions || []).reduce((s: number, d: any) => s + d.amount, 0);
        return sum + (salary - (globalDeductionTotal + manualDed));
      }, 0);
      ushHeaderRow.getCell(6).value = { formula: `SUM(E${usherDataStart}:E${usherDataEnd})`, result: ushTotal } as any;
      ushHeaderRow.getCell(6).numFmt = '#,##0';

      // ─── Total row ─────────────────────────────────────────────────────
      const totalRowNum = usherDataEnd + 1;
      const totalRow = sheet.addRow(['Total', '', '', '', '', null]);
      sheet.mergeCells(`A${totalRowNum}:E${totalRowNum}`);
      applyNavyRow(totalRow);
      totalRow.getCell(6).value = { formula: `F3+F${usherHeaderRowNum}`, result: supTotal + ushTotal } as any;
      totalRow.getCell(6).numFmt = '#,##0';
      totalRow.getCell(6).style = { ...navyStyle } as any;

      // Write & download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Salary-${event?.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'Event'}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: 'Salary sheet exported!' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Export failed', description: 'Could not generate salary sheet', variant: 'destructive' });
    } finally {
      setIsExportingSalary(false);
    }
  };

  if (isEventLoading) {
    return <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
      <Loader2 className="w-5 h-5 animate-spin" /> Loading event details...
    </div>;
  }

  if (!event) {
    return <div className="p-8 text-center text-muted-foreground">Event not found.</div>;
  }

  const isCompleted = event.status === "completed" || new Date(event.endTime) < new Date();
  const hasStarted = isCompleted || new Date(event.startTime) <= new Date();

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
      {/* Top Header */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Link href="/events">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold tracking-tight">{event.title}</h1>
            <Badge 
              variant="outline" 
              className={
                isCompleted 
                  ? "bg-slate-500/10 text-slate-600 border-slate-200 capitalize"
                  : event.status === "published" 
                    ? "bg-green-500/10 text-green-600 border-green-200 capitalize" 
                    : "bg-amber-500/10 text-amber-600 border-amber-200 capitalize"
              }
            >
              {isCompleted ? "completed" : event.status}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground ml-11">
            <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {event.eventLocName}</span>
            <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {format(new Date(event.startTime), 'MMM d, yyyy')}</span>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex gap-2">
          {!isCompleted && (
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Edit className="w-4 h-4" /> Edit Event
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleEditSubmit}>
                  <DialogHeader>
                    <DialogTitle>Edit Event</DialogTitle>
                    <DialogDescription>Update event parameters and details.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-1 gap-2">
                      <Label htmlFor="title">Title *</Label>
                      <Input 
                        id="title" 
                        value={formData.title} 
                        onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                        required 
                      />
                    </div>

                    <LocationPicker
                      radiusMeters={formData.checkinRadiusM ? parseInt(formData.checkinRadiusM, 10) : 100}
                      value={{
                        address: formData.eventLocName,
                        lat: formData.venueLat ? parseFloat(formData.venueLat) : null,
                        lng: formData.venueLng ? parseFloat(formData.venueLng) : null,
                      }}
                      onChange={(loc) => {
                        setFormData((prev) => ({
                          ...prev,
                          eventLocName: loc.address,
                          venueLat: loc.lat !== null ? String(loc.lat) : "",
                          venueLng: loc.lng !== null ? String(loc.lng) : "",
                        }));
                      }}
                    />

                    {/* Geofence Range */}
                    <div className="p-3 border rounded-lg bg-muted/20 space-y-2">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="checkinRadiusM" className="font-semibold text-xs flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-primary" />
                          Arrival & Leave Geofence Range (Meters)
                        </Label>
                        <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          {formData.checkinRadiusM || 100}m
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          id="checkinRadiusM"
                          type="number"
                          min="20"
                          max="5000"
                          value={formData.checkinRadiusM}
                          onChange={(e) => setFormData((p) => ({ ...p, checkinRadiusM: e.target.value }))}
                          className="w-28 font-bold text-sm"
                        />
                        <span className="text-xs text-muted-foreground">meters max distance</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {[50, 100, 150, 250, 500, 1000].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setFormData((p) => ({ ...p, checkinRadiusM: String(preset) }))}
                            className={`text-[11px] px-2 py-0.5 rounded border font-medium ${
                              formData.checkinRadiusM === String(preset)
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background hover:bg-muted text-muted-foreground"
                            }`}
                          >
                            {preset}m
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="startDate">Start Date *</Label>
                        <Input 
                          id="startDate" 
                          type="date" 
                          value={formData.startDate} 
                          onChange={e => setFormData(p => ({ ...p, startDate: e.target.value }))}
                          required 
                        />
                      </div>
                      <div>
                        <Label htmlFor="startTime">Start Time *</Label>
                        <Input 
                          id="startTime" 
                          type="time" 
                          value={formData.startTime} 
                          onChange={e => setFormData(p => ({ ...p, startTime: e.target.value }))}
                          required 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="endDate">End Date *</Label>
                        <Input 
                          id="endDate" 
                          type="date" 
                          value={formData.endDate} 
                          onChange={e => setFormData(p => ({ ...p, endDate: e.target.value }))}
                          required 
                        />
                      </div>
                      <div>
                        <Label htmlFor="endTime">End Time *</Label>
                        <Input 
                          id="endTime" 
                          type="time" 
                          value={formData.endTime} 
                          onChange={e => setFormData(p => ({ ...p, endTime: e.target.value }))}
                          required 
                        />
                      </div>
                    </div>

                    
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="leaderRate">Leader Pay Rate (EGP)</Label>
                          <Input 
                            id="leaderRate" 
                            type="number" 
                            value={formData.leaderRate} 
                            onChange={e => setFormData(p => ({ ...p, leaderRate: e.target.value }))}
                            disabled={isFieldLocked('leaderRate')}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="regularRate">Regular Pay Rate (EGP)</Label>
                          <Input 
                            id="regularRate" 
                            type="number" 
                            value={formData.regularRate} 
                            onChange={e => setFormData(p => ({ ...p, regularRate: e.target.value }))}
                            disabled={isFieldLocked('regularRate')}
                          />
                        </div>
                      </div>
                      {isSuperAdmin && (
                        <div className="grid grid-cols-1 gap-2">
                          <Label htmlFor="budget">Total Event Budget (EGP)</Label>
                          <Input 
                            id="budget" 
                            type="number" 
                            value={formData.budget} 
                            onChange={e => setFormData(p => ({ ...p, budget: e.target.value }))}
                          />
                        </div>
                      )}
    

                    <div className="grid grid-cols-1 gap-2">
                      <Label htmlFor="dressCode">Dress Code</Label>
                      <Input 
                        id="dressCode" 
                        value={formData.dressCode} 
                        onChange={e => setFormData(p => ({ ...p, dressCode: e.target.value }))}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      <Label htmlFor="instructions">Instructions</Label>
                      <Textarea 
                        id="instructions" 
                        rows={3} 
                        value={formData.instructions} 
                        onChange={e => setFormData(p => ({ ...p, instructions: e.target.value }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={isUpdating}>
                      {isUpdating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Save Changes
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}

          {!isCompleted && event.status !== 'cancelled' && (
            <Button
              variant="default"
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
              onClick={async () => {
                if (window.confirm('Are you sure you want to complete this event and process payouts manually?')) {
                  try {
                    await fetch(`/api/events/${event.id}/complete`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                      }
                    });
                    refetch();
                  } catch (err) {
                    console.error(err);
                    alert('Failed to complete event');
                  }
                }
              }}
            >
              Complete & Process
            </Button>
          )}

          <Button
            variant="outline"
            className="gap-2"
            onClick={handleExportPDF}
            disabled={isExportingPDF}
          >
            {isExportingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Export PDF
          </Button>

          <Button
            variant="outline"
            className="gap-2"
            onClick={handleExportSalarySheet}
            disabled={isExportingSalary}
          >
            {isExportingSalary ? <Loader2 className="w-4 h-4 animate-spin" /> : <TableIcon className="w-4 h-4" />}
            Export Salary
          </Button>

          <Button 
            variant={event.status === "published" ? "outline" : "default"} 
            className="gap-2"
            disabled={isUpdating || isCompleted || user?.role !== "super_admin"}
            onClick={handlePublishToggle}
          >
            {isUpdating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Globe className="w-4 h-4" />
            )}
            {event.status === "published" ? "Unpublish (Set Draft)" : "Publish Event"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0 pb-6 mt-4">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0 space-x-6">
          <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3">Overview</TabsTrigger>
          <TabsTrigger value="staffing" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3">Staff & Teams</TabsTrigger>
          <TabsTrigger value="deductions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3">
            Deductions
            {(event.deductionRules || []).length > 0 && (
              <span className="ml-1.5 text-xs bg-destructive/15 text-destructive rounded-full px-1.5 py-0.5 font-semibold">
                {(event.deductionRules || []).length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6 min-h-0 flex-1 overflow-auto">
          {/* Details */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Schedule & Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Start Time</span>
                  <span className="font-medium">{format(new Date(event.startTime), 'h:mm a')}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">End Time</span>
                  <span className="font-medium">{format(new Date(event.endTime), 'h:mm a')}</span>
                </div>
                
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">Budget</span>
                    <span className="font-medium">EGP {event.budget?.toLocaleString() || "Not set"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">Leader Pay Rate</span>
                    <span className="font-medium">EGP {event.leaderRate?.toLocaleString() || "Not set"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">Regular Pay Rate</span>
                    <span className="font-medium">EGP {event.regularRate?.toLocaleString() || "Not set"}</span>
                  </div>
  
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Geofence Range</span>
                  <span className="font-semibold text-primary">{event.checkinRadiusM || 100} meters</span>
                </div>
                <div className="pt-2">
                  <h4 className="font-medium mb-1">Dress Code</h4>
                  <p className="text-muted-foreground">{event.dressCode || "None specified"}</p>
                </div>
                <div className="pt-2">
                  <h4 className="font-medium mb-1">Instructions</h4>
                  <p className="text-muted-foreground whitespace-pre-wrap">{event.instructions || "None specified"}</p>
                </div>
              </CardContent>
            </Card>


          </div>

          {/* Details Column 2 */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Attendance Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const totalAssigned = event.assignments?.filter((a: any) => !['pending', 'applied', 'rejected'].includes(a.status)).length || 0;
                  const checkedInCount = event.assignments?.filter((a: any) => ["checked_in", "completed"].includes(a.status)).length || 0;
                  const pendingApplicantsCount = event.assignments?.filter((a: any) => a.status === 'applied').length || 0;
                  const canceledCount = event.assignments?.filter((a: any) => a.status === "cancelled").length || 0;
                  const lateCount = event.assignments?.filter((a: any) => a.lateArrivalMinutes > 0).length || 0;

                  return (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-muted rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold">{totalAssigned}</div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Total Assigned</div>
                      </div>
                      <div className="bg-primary/10 text-primary rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold">{checkedInCount}</div>
                        <div className="text-xs uppercase tracking-wider mt-1">Checked In</div>
                      </div>
                      <div className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold">{pendingApplicantsCount}</div>
                        <div className="text-xs uppercase tracking-wider mt-1">Pending Applicants</div>
                      </div>
                      <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold">{lateCount}</div>
                        <div className="text-xs uppercase tracking-wider mt-1">Late / No-Show</div>
                      </div>
                      {canceledCount > 0 && (
                        <div className="bg-muted rounded-lg p-4 text-center col-span-2">
                          <div className="text-xl font-bold text-muted-foreground">{canceledCount}</div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Canceled</div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shirt className="w-5 h-5 text-primary" />
                  Sizes Summary
                </CardTitle>
                <CardDescription>Aggregate of sizes for all active ushers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const activeAssignments = event.assignments?.filter((a: any) => ['assigned', 'accepted', 'checked_in', 'completed'].includes(a.status)) || [];
                  const getCounts = (key: string) => {
                    const counts: Record<string, number> = {};
                    activeAssignments.forEach((a: any) => {
                      const val = a.usher?.[key];
                      if (val) counts[val] = (counts[val] || 0) + 1;
                    });
                    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
                  };

                  const renderSizeRow = (title: string, counts: [string, number][]) => {
                    if (counts.length === 0) return null;
                    return (
                      <div className="flex flex-col border-b last:border-0 pb-3 last:pb-0">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">{title}</span>
                        <div className="flex flex-wrap gap-2">
                          {counts.map(([size, count]) => (
                            <div key={size} className="flex items-center bg-muted rounded-md px-2 py-1">
                              <span className="font-semibold text-sm">{size}</span>
                              <span className="ml-1.5 text-xs text-muted-foreground bg-background rounded px-1.5 py-0.5 font-medium">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  };

                  return (
                    <div className="space-y-3">
                      {renderSizeRow('T-Shirts', getCounts('tShirtSize'))}
                      {renderSizeRow('Shirts', getCounts('shirtSize'))}
                      {renderSizeRow('Pants', getCounts('pantsSize'))}
                      {renderSizeRow('Shorts', getCounts('shortsSize'))}
                      {renderSizeRow('Dresses', getCounts('dressSize'))}
                      {renderSizeRow('Shoes', getCounts('shoeSize'))}
                      {activeAssignments.length > 0 && 
                        !Object.keys(getCounts('tShirtSize')).length && 
                        !Object.keys(getCounts('shirtSize')).length &&
                        !Object.keys(getCounts('pantsSize')).length &&
                        !Object.keys(getCounts('shortsSize')).length &&
                        !Object.keys(getCounts('dressSize')).length &&
                        !Object.keys(getCounts('shoeSize')).length && (
                        <div className="text-sm text-muted-foreground text-center py-2">No size data available</div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>

          {/* Details Column 3 */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  Rate Event Link
                </CardTitle>
                <CardDescription>
                  Share this public link with the client so they can rate the event and its teams.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isFeedbackLinkLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : feedbackLink ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Input 
                        readOnly 
                        value={`${window.location.origin}/feedback/${feedbackLink.token}`} 
                        className="font-mono text-sm"
                      />
                      <Button variant="outline" size="icon" onClick={handleCopyFeedbackLink} title="Copy Link">
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Status:</span>
                      {feedbackLink.submittedAt ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircle className="w-3 h-3 mr-1" /> Submitted
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-600 dark:text-yellow-500 dark:border-yellow-500">
                          Waiting for submission
                        </Badge>
                      )}
                    </div>
                    {(!isFieldLocked("budget") || isSuperAdmin) && (
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="w-full mt-2" 
                        onClick={() => createFeedbackLinkMutation.mutate({ id: eventId })}
                        disabled={createFeedbackLinkMutation.isPending}
                      >
                        {createFeedbackLinkMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                        Regenerate Link
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4 space-y-3">
                    <p className="text-sm text-muted-foreground">No feedback link generated yet.</p>
                    <Button 
                      onClick={() => createFeedbackLinkMutation.mutate({ id: eventId })}
                      disabled={createFeedbackLinkMutation.isPending || (isFieldLocked("budget") && !isSuperAdmin)}
                      className="w-full"
                    >
                      {createFeedbackLinkMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LinkIcon className="w-4 h-4 mr-2" />}
                      Generate Link
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="staffing" className="grid md:grid-cols-3 gap-6 mt-6 min-h-0 flex-1 overflow-auto">
          {/* Teams Col */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3 border-b border-primary/10">
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Teams
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-4 space-y-4">
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Input 
                    placeholder="New Team Name" 
                    value={newTeamName} 
                    onChange={e => setNewTeamName(e.target.value)} 
                  />
                  <Button 
                    disabled={!newTeamName.trim() || isCreatingTeam} 
                    onClick={() => createTeam({ id: eventId, data: { name: newTeamName } })}
                  >
                    Add
                  </Button>
                </div>
                <Textarea 
                  placeholder="Team Instructions (Optional)" 
                  value={newTeamInstructions} 
                  onChange={e => setNewTeamInstructions(e.target.value)} 
                  className="text-sm min-h-[60px]"
                />
              </div>

              <div className="space-y-2">
                <div 
                  className={`p-3 rounded border cursor-pointer transition-colors ${selectedTeamId === null ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                  onClick={() => setSelectedTeamId(null)}
                >
                  <div className="font-medium text-sm">All Staff (Unassigned)</div>
                </div>
                {teams?.map((team: any) => (
                  <div 
                    key={team.id}
                    className={`p-3 rounded border cursor-pointer transition-colors flex justify-between items-center ${selectedTeamId === team.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                    onClick={() => setSelectedTeamId(team.id)}
                  >
                    <div className="font-medium text-sm">{team.name}</div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete team ${team.name}? Ushes will become unassigned.`)) {
                          deleteTeam({ id: eventId, teamId: team.id });
                        }
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>

              {selectedTeamId && leaderSuggestions && leaderSuggestions.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-500" /> Leader Suggestions
                  </h4>
                  <div className="space-y-2">
                    {leaderSuggestions.map((sug: any) => (
                      <div key={sug.id} className="flex justify-between items-center border p-2 rounded text-xs bg-amber-50/50">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarImage src={getImageUrl(sug.profilePhotoKey) || sug.profilePhotoUrl || undefined} />
                            <AvatarFallback className="text-[10px] bg-amber-100 text-amber-800">{sug.fullName?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span>{sug.fullName} <span className="text-muted-foreground ml-1">({(sug.matchScore * 100).toFixed(0)}% match)</span></span>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-6 px-2 text-[10px]"
                          onClick={() => {
                            const assignment = event.assignments?.find((a: any) => a.usherId === sug.id);
                            if (assignment) {
                              updateAssignment({ id: eventId, assignmentId: assignment.id, data: { usherId: assignment.usherId, eventTeamId: selectedTeamId, isTeamLead: true, role: 'leader' } });
                            }
                          }}
                        >
                          Make Lead
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Middle Col - Assigned Ushers */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3 border-b border-primary/10">
              <CardTitle className="flex items-center justify-between">
                
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Assigned Staff ({event.assignments?.filter((a: any) => ((a.status !== 'pending' && a.status !== 'applied') && a.status !== 'rejected') && (selectedTeamId === null ? true : a.eventTeamId === selectedTeamId)).length || 0})
                  </span>
                  {event.budget && (
                    <span className={`text-xs font-normal ${isBudgetExceeded ? 'text-destructive' : 'text-muted-foreground'}`}>
                      Budget: EGP {totalSpent.toLocaleString()} / {event.budget.toLocaleString()} 
                      {isBudgetExceeded && ' (Exceeded)'}
                    </span>
                  )}
                </div>
  
                {selectedTeamId !== null && (
                  <Badge variant="outline" className="text-xs bg-primary/10">
                    {teams?.find((t: any) => t.id === selectedTeamId)?.name}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              <div className="divide-y">
                {event.assignments?.filter((a: any) => ((a.status !== 'pending' && a.status !== 'applied') && a.status !== 'rejected') && (selectedTeamId === null ? true : a.eventTeamId === selectedTeamId)).map((assignment: any) => (
                  <div key={assignment.id} className="p-4 hover:bg-muted/10 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={getImageUrl(assignment.usher?.profilePhotoKey) || assignment.usher?.profilePhotoUrl || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {assignment.usher?.fullName?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm flex items-center gap-2">
                            {assignment.usher?.fullName}
                            {assignment.isTeamLead && <Badge variant="secondary" className="text-[10px] h-4 bg-amber-100 text-amber-800 hover:bg-amber-100">Lead</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                            <span className="flex items-center">
                              <Star className="w-3 h-3 text-secondary mr-1 fill-current" />
                              {assignment.usher?.avgRating?.toFixed(1) || 'N/A'}
                            </span>
                            <span className="capitalize text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{assignment.status === 'assigned' ? 'Pending' : assignment.status.replace('_', ' ')}</span>
                            {assignment.usher?.gender === 'female' && assignment.usher?.dressSize && (
                              <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-normal">Dress: {assignment.usher.dressSize}</Badge>
                            )}
                            {assignment.usher?.shoeSize && (
                              <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-normal">Shoe: {assignment.usher.shoeSize}</Badge>
                            )}
                            {event.status === 'completed' && assignment.checkinTime && !assignment.checkoutTime && (
                              <Badge variant="destructive" className="text-[9px] h-4 px-1.5 leading-none shadow-sm animate-pulse">
                                MISSED CHECKOUT
                              </Badge>
                            )}
                            {assignment.manualDeductions && assignment.manualDeductions.length > 0 && (
                              <Badge variant="destructive" className="text-[9px] h-4 px-1.5 font-normal ml-1">
                                {assignment.manualDeductions.length} deductions (-{assignment.manualDeductions.reduce((sum: number, d: any) => sum + d.amount, 0)} EGP)
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <div className="flex flex-wrap justify-end items-center gap-2">
                          {(assignment.checkinTime || assignment.checkinPhotoKey) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs gap-1 text-primary hover:bg-primary/10"
                              onClick={() => setCheckinDetailsAssignment(assignment)}
                            >
                              <Camera className="w-3.5 h-3.5" />
                              Check-in Info
                            </Button>
                          )}
                          {assignment.checkinTime && !assignment.checkoutTime && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs gap-1 text-primary hover:bg-primary/10"
                              disabled={isAdminCheckingOut}
                              onClick={() => {
                                if (confirm(`Force checkout for ${assignment.usher?.fullName}?`)) {
                                  adminCheckout({ id: eventId, assignmentId: assignment.id });
                                }
                              }}
                            >
                              <LogOut className="w-3.5 h-3.5" />
                              Checkout
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 text-xs gap-1 text-amber-600 hover:bg-amber-50"
                            onClick={() => handleOpenRating(assignment)}
                          >
                            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                            Rate
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 text-xs gap-1 text-destructive hover:bg-destructive/10"
                            onClick={() => setManualDeductionAssignment(assignment)}
                          >
                            <MinusCircle className="w-3.5 h-3.5" />
                            Deduct
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs gap-1 text-destructive hover:bg-destructive/10"
                            disabled={hasStarted || (assignment.status !== 'assigned' && assignment.status !== 'accepted')}
                            onClick={() => {
                              if (confirm("Are you sure you want to unassign this usher?")) {
                                removeUsher({ id: eventId, assignmentId: assignment.id });
                              }
                            }}
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                            Remove
                          </Button>
                        </div>
                        
                        {selectedTeamId === null && teams && teams.length > 0 && !hasStarted && (
                          <select 
                            className="text-[10px] border rounded px-1 py-0.5 mt-1 bg-muted/20"
                            value={assignment.eventTeamId || ""}
                            onChange={(e) => {
                              const tid = e.target.value ? parseInt(e.target.value, 10) : null;
                              updateAssignment({ id: eventId, assignmentId: assignment.id, data: { usherId: assignment.usherId, eventTeamId: tid, isTeamLead: false, role: 'regular' } });
                            }}
                          >
                            <option value="">Assign to team...</option>
                            {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        )}
                        {!hasStarted && (
                          <div className="flex items-center gap-1 mt-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-6 w-6 rounded-full shrink-0 ${(assignment.isTeamLead || assignment.role === 'leader') ? 'text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 hover:text-amber-600' : 'text-muted-foreground hover:bg-muted'}`}
                              onClick={() => {
                                const isCurrentlyLead = assignment.isTeamLead || assignment.role === 'leader';
                                updateAssignment({ 
                                  id: eventId, 
                                  assignmentId: assignment.id, 
                                  data: { 
                                    usherId: assignment.usherId,
                                    eventTeamId: assignment.eventTeamId,
                                    role: isCurrentlyLead ? 'regular' : 'leader',
                                    isTeamLead: !isCurrentlyLead,
                                  } 
                                });
                              }}
                              title={(assignment.isTeamLead || assignment.role === 'leader') ? "Team Leader (Click to demote)" : "Make Team Leader"}
                            >
                              <Crown className="w-4 h-4" />
                            </Button>
                            <AssignmentPayInput assignment={assignment} updateAssignment={updateAssignment} eventId={eventId} />
                          </div>
                        )}

                      </div>
                    </div>
                  </div>
                ))}
                {(!event.assignments || event.assignments.filter((a: any) => selectedTeamId === null ? true : a.eventTeamId === selectedTeamId).length === 0) && (
                  <div className="p-6 text-center text-sm text-muted-foreground">No ushers assigned.</div>
                )}
              </div>
            </CardContent>
          </Card>


          {/* Right Col - Pending Applicants */}
          <Card className="flex flex-col border-primary/20 bg-primary/5">
            <CardHeader className="pb-3 border-b border-primary/10">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <Users className="w-5 h-5" />
                    Pending Applicants
                  </CardTitle>
                  <CardDescription>Ushers who applied for this event.</CardDescription>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Gender</Label>
                  <select 
                    className="w-full text-xs h-8 rounded-md border border-input bg-background px-2"
                    value={filterGender}
                    onChange={e => setFilterGender(e.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Language</Label>
                  <select 
                    className="w-full text-xs h-8 rounded-md border border-input bg-background px-2"
                    value={filterLanguage}
                    onChange={e => setFilterLanguage(e.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="English">English</option>
                    <option value="Arabic">Arabic</option>
                    <option value="French">French</option>
                    <option value="German">German</option>
                    <option value="Spanish">Spanish</option>
                    <option value="Italian">Italian</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Min Rating</Label>
                  <Input 
                    type="number" min="0" max="5" step="0.1" 
                    className="h-8 text-xs" 
                    placeholder="e.g. 4.5"
                    value={filterMinRating}
                    onChange={e => setFilterMinRating(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Min Height (cm)</Label>
                  <Input 
                    type="number" min="100" max="250" 
                    className="h-8 text-xs" 
                    placeholder="e.g. 170"
                    value={filterMinHeight}
                    onChange={e => setFilterMinHeight(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Dress Size</Label>
                  <select 
                    className="w-full text-xs h-8 rounded-md border border-input bg-background px-2"
                    value={filterDressSize}
                    onChange={e => setFilterDressSize(e.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="XS">XS</option>
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                    <option value="XL">XL</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Shoe Size</Label>
                  <Input 
                    type="text" 
                    className="h-8 text-xs" 
                    placeholder="e.g. 42"
                    value={filterShoeSize}
                    onChange={e => setFilterShoeSize(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0 pt-2">
              <div className="divide-y divide-primary/10">
                {(() => {
                  const pending = event?.assignments?.filter((a: any) => {
                    if (a.status !== 'pending' && a.status !== 'applied') return false;
                    
                    if (filterGender !== 'all' && a.usher?.gender !== filterGender) return false;
                    
                    if (filterMinHeight && a.usher?.height) {
                      if (a.usher.height < parseInt(filterMinHeight, 10)) return false;
                    }
                    if (filterMinHeight && !a.usher?.height) return false;
                    
                    if (filterLanguage !== 'all' && a.usher?.languages) {
                      if (!a.usher.languages.includes(filterLanguage)) return false;
                    }
                    if (filterLanguage !== 'all' && !a.usher?.languages) return false;
                    
                    if (filterShoeSize && filterShoeSize !== 'all' && a.usher?.shoeSize !== filterShoeSize) return false;
                    if (filterDressSize !== 'all' && a.usher?.dressSize !== filterDressSize) return false;
                    
                    if (filterMinRating && a.usher?.avgRating) {
                      if (Number(a.usher.avgRating) < parseFloat(filterMinRating)) return false;
                    }
                    if (filterMinRating && !a.usher?.avgRating) return false;
                    
                    return true;
                  }) || [];

                  if (pending.length === 0) {
                    return <div className="p-4 text-center text-sm text-muted-foreground">No pending applicants found.</div>;
                  }

                  return pending.map((applicant: any) => (
                    <div key={applicant.id} className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8 border border-background">
                          <AvatarImage src={getImageUrl(applicant.usher?.profilePhotoKey) || applicant.usher?.profilePhotoUrl || undefined} />
                          <AvatarFallback className="text-xs">{applicant.usher?.fullName?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium leading-none">{applicant.usher?.fullName}</p>
                            {!applicant.usher?.isAvailable && (
                              <Badge variant="destructive" className="text-[10px] h-4 px-1.5 leading-none">
                                Busy
                              </Badge>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                             <span className="capitalize">{applicant.usher?.gender}</span>
                             {applicant.usher?.shirtSize && <span className="whitespace-nowrap">• Shirt: {applicant.usher.shirtSize}</span>}
                             {applicant.usher?.tShirtSize && <span className="whitespace-nowrap">• T-Shirt: {applicant.usher.tShirtSize}</span>}
                             {applicant.usher?.pantsSize && <span className="whitespace-nowrap">• Pants: {applicant.usher.pantsSize}</span>}
                             {applicant.usher?.shortsSize && <span className="whitespace-nowrap">• Shorts: {applicant.usher.shortsSize}</span>}
                             {applicant.usher?.gender === 'female' && applicant.usher?.dressSize && <span className="whitespace-nowrap">• Dress: {applicant.usher.dressSize}</span>}
                             {applicant.usher?.shoeSize && <span className="whitespace-nowrap">• Shoe: {applicant.usher.shoeSize}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="h-7 text-xs bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                          disabled={hasStarted}
                          onClick={() => updateAssignment({ id: eventId, assignmentId: applicant.id, data: { usherId: applicant.usher!.id, status: 'accepted' } as any })}
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Approve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 text-xs text-destructive hover:bg-destructive/10"
                          disabled={hasStarted}
                          onClick={() => updateAssignment({ id: eventId, assignmentId: applicant.id, data: { usherId: applicant.usher!.id, status: 'rejected' } as any })}
                        >
                          <XCircle className="w-3 h-3 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── DEDUCTIONS TAB ─────────────────────────────────────────── */}
        <TabsContent value="deductions" className="mt-6 min-h-0 flex-1 overflow-auto">
          <div className="max-w-2xl space-y-6">

            {/* Summary banner */}
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-destructive uppercase tracking-wider">Total Deduction Per Usher</p>
                <p className="text-4xl font-bold text-destructive mt-1">
                  -{(event.deductionRules || []).reduce((s: number, r: any) => s + r.amount, 0)} EGP
                </p>
                <p className="text-xs text-muted-foreground mt-1">Applied automatically at checkout for all ushers</p>
              </div>
              <X className="w-12 h-12 text-destructive/20" />
            </div>

            {/* Existing rules */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Active Rules</CardTitle>
                <CardDescription>Each rule is deducted from every usher's pay when they check out.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {(event.deductionRules || []).length === 0 && (
                  <div className="text-sm text-muted-foreground py-4 text-center">No deduction rules yet.</div>
                )}
                {(event.deductionRules || []).map((rule: any) => (
                  <div key={rule.id} className="flex justify-between items-center border rounded-lg p-3 bg-muted/20 group">
                    <div>
                      <p className="font-medium text-sm">{rule.ruleType}</p>
                      <p className="text-xs text-muted-foreground">Flat deduction</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-destructive font-bold">- {rule.amount} EGP</span>
                      <button
                        onClick={() => deleteDeductionRule({ id: eventId, ruleId: rule.id })}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                        title="Delete rule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Add rule form */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Add New Rule</CardTitle>
                <CardDescription>Define a deduction that will be applied to all ushers at checkout.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="rule-type">Rule Name</Label>
                  <Input
                    id="rule-type"
                    placeholder="e.g. Late Arrival, Early Leave, Dress Code Violation"
                    value={newRuleType}
                    onChange={(e) => setNewRuleType(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rule-amount">Deduction Amount (EGP)</Label>
                  <Input
                    id="rule-amount"
                    type="number"
                    placeholder="0"
                    value={newRuleAmount}
                    onChange={(e) => setNewRuleAmount(e.target.value)}
                    min={0}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rule-trigger">Trigger</Label>
                  <select
                    id="rule-trigger"
                    className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={newRuleTrigger}
                    onChange={(e) => setNewRuleTrigger(e.target.value)}
                  >
                    <option value="always">Always Apply</option>
                    <option value="late_arrival">Late Arrival</option>
                    <option value="early_leave">Early Leave</option>
                  </select>
                </div>
                {(newRuleTrigger === 'late_arrival' || newRuleTrigger === 'early_leave') && (
                  <div className="space-y-1">
                    <Label htmlFor="rule-threshold">Threshold (Minutes)</Label>
                    <Input
                      id="rule-threshold"
                      type="number"
                      placeholder="e.g. 15"
                      value={newRuleThreshold}
                      onChange={(e) => setNewRuleThreshold(e.target.value)}
                      min={0}
                    />
                  </div>
                )}
                <Button
                  className="w-full mt-4"
                  disabled={!newRuleType.trim() || !newRuleAmount || isCreatingRule}
                  onClick={() => {
                    const amount = parseFloat(newRuleAmount);
                    if (isNaN(amount) || amount <= 0) return;
                    
                    let threshold: number | undefined;
                    if (newRuleTrigger !== 'always' && newRuleThreshold) {
                      threshold = parseInt(newRuleThreshold, 10);
                    }
                    
                    createDeductionRule({ 
                      id: eventId, 
                      data: { 
                        ruleType: newRuleType.trim(), 
                        amount,
                        triggerType: newRuleTrigger,
                        thresholdMinutes: threshold,
                      } 
                    });
                    
                    setNewRuleType('');
                    setNewRuleAmount('');
                    setNewRuleThreshold('');
                  }}
                >
                  {isCreatingRule ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Add Deduction Rule
                </Button>
              </CardContent>
            </Card>

          </div>
        </TabsContent>

</Tabs>


      {/* Rate Usher Dialog */}
      <Dialog open={!!ratingAssignment} onOpenChange={(open) => !open && setRatingAssignment(null)}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSubmitRating}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                Rate Usher: {ratingAssignment?.usher?.fullName}
              </DialogTitle>
              <DialogDescription>
                Provide a performance score and feedback for this assignment.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Star Selector */}
              <div className="space-y-2 text-center">
                <Label className="text-sm font-semibold">Rating Score</Label>
                <div className="flex justify-center items-center gap-2 pt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingValue(star)}
                      className="p-1.5 transition-transform hover:scale-125 focus:outline-none"
                    >
                      <Star
                        className={`w-8 h-8 ${
                          star <= ratingValue
                            ? "text-amber-500 fill-amber-500"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground font-semibold">
                  {ratingValue === 5 && "⭐ Excellent - Exceeded Expectations"}
                  {ratingValue === 4 && "👍 Very Good - Professional & Reliable"}
                  {ratingValue === 3 && "👌 Good - Satisfactory"}
                  {ratingValue === 2 && "⚠️ Below Average - Needs Improvement"}
                  {ratingValue === 1 && "❌ Poor - Unacceptable Performance"}
                </p>
              </div>

              {/* Feedback Comment */}
              <div className="space-y-2">
                <Label htmlFor="comment">Feedback / Comments (Optional)</Label>
                <Textarea
                  id="comment"
                  rows={3}
                  placeholder="e.g. Arrived on time, led the team exceptionally well..."
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRatingAssignment(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmittingRating} className="bg-amber-600 hover:bg-amber-700 text-white">
                {isSubmittingRating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Submit Rating
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
    </Dialog>

      {/* Manual Deduction Dialog */}
      <Dialog open={!!manualDeductionAssignment} onOpenChange={(open) => !open && setManualDeductionAssignment(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MinusCircle className="w-5 h-5 text-destructive" />
              Manage Manual Deductions
            </DialogTitle>
            <DialogDescription>
              Deduct pay from {manualDeductionAssignment?.usher?.fullName}. This will be subtracted during checkout.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {manualDeductionAssignment?.manualDeductions && manualDeductionAssignment.manualDeductions.length > 0 && (
              <div className="space-y-2">
                <Label>Existing Deductions</Label>
                <div className="border rounded-md divide-y overflow-hidden text-sm">
                  {manualDeductionAssignment.manualDeductions.map((d: any) => (
                    <div key={d.id} className="p-2 flex justify-between items-center bg-muted/20">
                      <div className="flex flex-col">
                        <span className="font-medium">{d.reason}</span>
                        <span className="text-xs text-muted-foreground">- {d.amount} EGP</span>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => removeManualDeduction({ id: eventId, assignmentId: manualDeductionAssignment.id, deductionId: d.id })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1 mt-4 pt-4 border-t">
              <Label htmlFor="deduction-reason">New Deduction Reason</Label>
              <Input
                id="deduction-reason"
                placeholder="e.g. Dress Code Violation"
                value={manualDeductionReason}
                onChange={(e) => setManualDeductionReason(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="deduction-amount">Amount (EGP)</Label>
              <Input
                id="deduction-amount"
                type="number"
                placeholder="0"
                min="0"
                value={manualDeductionAmount}
                onChange={(e) => setManualDeductionAmount(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setManualDeductionAssignment(null)} disabled={isAddingManualDeduction}>
              Close
            </Button>
            <Button 
              type="button" 
              variant="destructive"
              disabled={isAddingManualDeduction || !manualDeductionReason.trim() || !manualDeductionAmount}
              onClick={() => {
                const amount = parseFloat(manualDeductionAmount);
                if (isNaN(amount) || amount <= 0) return;
                addManualDeduction({
                  id: eventId,
                  assignmentId: manualDeductionAssignment.id,
                  data: { reason: manualDeductionReason.trim(), amount }
                });
              }}
            >
              {isAddingManualDeduction ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Add Deduction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Check-in Details Dialog */}
      <Dialog open={!!checkinDetailsAssignment} onOpenChange={(open) => !open && setCheckinDetailsAssignment(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Check-in Details</DialogTitle>
            <DialogDescription>
              Attendance information for {checkinDetailsAssignment?.usher?.fullName}
            </DialogDescription>
          </DialogHeader>
          {checkinDetailsAssignment && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Check-in Time</span>
                  <span className="text-sm font-medium">
                    {checkinDetailsAssignment.checkinTime ? format(new Date(checkinDetailsAssignment.checkinTime), "MMM d, h:mm a") : "Not checked in"}
                  </span>
                </div>
                <div className="flex flex-col space-y-1">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Checkout Time</span>
                  <span className="text-sm font-medium">
                    {checkinDetailsAssignment.checkoutTime ? format(new Date(checkinDetailsAssignment.checkoutTime), "MMM d, h:mm a") : "Not checked out"}
                  </span>
                </div>
                <div className="flex flex-col space-y-1">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Late Arrival</span>
                  <span className={`text-sm font-medium ${checkinDetailsAssignment.lateArrivalMinutes > 0 ? "text-destructive" : "text-green-600"}`}>
                    {checkinDetailsAssignment.lateArrivalMinutes || 0} mins
                  </span>
                </div>
                <div className="flex flex-col space-y-1">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Early Leave</span>
                  <span className={`text-sm font-medium ${checkinDetailsAssignment.earlyLeaveMinutes > 0 ? "text-destructive" : "text-green-600"}`}>
                    {checkinDetailsAssignment.earlyLeaveMinutes || 0} mins
                  </span>
                </div>
              </div>

              {checkinDetailsAssignment.checkinPhotoKey && (
                <div className="flex flex-col space-y-2 mt-4 border-t pt-4">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Selfie / Proof</span>
                  <div className="rounded-xl overflow-hidden border bg-muted/20 relative w-full aspect-video flex items-center justify-center">
                    <img 
                      src={getImageUrl(checkinDetailsAssignment.checkinPhotoKey)} 
                      alt="Check-in Proof" 
                      className="max-w-full max-h-[300px] object-contain rounded-lg shadow-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Hidden PDF template */}
      <div className="absolute top-[-9999px] left-[-9999px]">
        <div ref={pdfRef} className="p-8 bg-white text-black font-sans" style={{ width: '800px' }}>
          <h1 className="text-2xl font-bold mb-2">Ushers Sheet</h1>
          <h2 className="text-xl mb-4">{event?.title || 'Event'}</h2>
          <p className="text-gray-600 mb-8">
            {event?.eventLocName || ''} | {event?.startTime ? format(new Date(event.startTime), 'MMM d, yyyy - h:mm a') : ''}
          </p>
          
          <table className="w-full border-collapse border border-gray-300 text-sm mb-8" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="p-2 border border-gray-300 w-16">Photo</th>
                <th className="p-2 border border-gray-300 text-left">Name</th>
                <th className="p-2 border border-gray-300 text-left">Role/Team</th>
                <th className="p-2 border border-gray-300 text-left">Phone</th>
                <th className="p-2 border border-gray-300 text-left">Signature / Notes</th>
              </tr>
            </thead>
            <tbody>
              {pdfAssignedUshers.map((assignment: any) => {
                const usher = assignment.usher;
                const teamName = teams?.find((t: any) => t.id === assignment.eventTeamId)?.name || 'Unassigned';
                const roleStr = assignment.isTeamLead ? 'Team Lead' : 'Regular';
                const photoUrl = getImageUrl(usher?.profilePhotoKey) || usher?.profilePhotoUrl;
                
                return (
                  <tr key={assignment.id} className="border-b border-gray-300" style={{ pageBreakInside: 'avoid' }}>
                    <td className="p-2 border border-gray-300 text-center">
                      {photoUrl ? (
                        <img src={photoUrl} className="w-10 h-10 rounded-full object-cover mx-auto" crossOrigin="anonymous" alt="Photo" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 mx-auto" />
                      )}
                    </td>
                    <td className="p-2 border border-gray-300" dir="auto">{usher?.fullName || 'N/A'}</td>
                    <td className="p-2 border border-gray-300" dir="auto">
                      <div className="font-medium">{teamName}</div>
                      <div className="text-gray-500 text-xs">{roleStr}</div>
                    </td>
                    <td className="p-2 border border-gray-300" dir="auto">{usher?.phone || 'N/A'}</td>
                    <td className="p-2 border border-gray-300"></td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ pageBreakBefore: 'always' }} className="mt-8">
            <h2 className="text-xl font-bold mb-2">Sizes Summary</h2>
            <p className="text-gray-600 text-sm mb-4">Aggregate of sizes for all ushers in this sheet:</p>
            
            <div className="space-y-3">
              {pdfSizeCategories.map(cat => {
                const counts = getCountsForPDF(cat.key);
                if (counts.length === 0) return null;
                return (
                  <div key={cat.key} className="flex flex-col gap-1">
                    <span className="font-semibold">{cat.label}:</span>
                    <span className="text-gray-600 text-sm ml-4">
                      {counts.map(c => `${c[0]} (${c[1]})`).join('  |  ')}
                    </span>
                  </div>
                );
              })}
              {pdfSizeCategories.every(cat => getCountsForPDF(cat.key).length === 0) && (
                <div className="text-gray-500 italic">No size data available.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
