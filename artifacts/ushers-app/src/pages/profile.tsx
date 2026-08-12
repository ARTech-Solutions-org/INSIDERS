import React, { useState, useEffect } from 'react';
import {
  useGetMyUsherProfile,
  useUpdateMyUsherProfile,
  useLogout,
  useListMySkills,
  useAddMySkill,
  useDeleteMySkill,
  useListMyAvailability,
  useSetMyAvailability,
  getGetMyUsherProfileQueryKey,
  getListMySkillsQueryKey,
  getListMyAvailabilityQueryKey
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { clearAuthToken } from '@/lib/auth';
import { useLocation, Link } from 'wouter';
import { User, Phone, Mail, CreditCard, ChevronRight, LogOut, Star, CheckCircle2, Shield, Settings, Plus, X, Calendar as CalendarIcon, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { format, addDays } from 'date-fns';

export default function Profile() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useGetMyUsherProfile();
  const { data: skills } = useListMySkills();
  const { data: availabilities } = useListMyAvailability({ from: format(new Date(), 'yyyy-MM-dd'), to: format(addDays(new Date(), 7), 'yyyy-MM-dd') });

  const updateMutation = useUpdateMyUsherProfile();
  const logoutMutation = useLogout();
  const addSkillMutation = useAddMySkill();
  const deleteSkillMutation = useDeleteMySkill();
  const setAvailMutation = useSetMyAvailability();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ fullName: '', phone: '' });

  const SKILL_OPTIONS: Record<string, string[]> = {
    language: ['Arabic', 'English', 'French', 'German', 'Spanish', 'Italian'],
    experience: ['Registration', 'Ushering', 'VIP Handling', 'Supervising', 'Customer Service', 'Scanning', 'Ticketing'],
    trait: ['Veiled', 'Non-Veiled', 'Height: 150-160cm', 'Height: 160-170cm', 'Height: 170-180cm', 'Height: 180cm+']
  };

  // Skill state
  const [newSkillType, setNewSkillType] = useState('language');
  const [newSkillValue, setNewSkillValue] = useState(SKILL_OPTIONS['language'][0]);
  const [showSkillDialog, setShowSkillDialog] = useState(false);

  // Availability state
  const [showAvailDialog, setShowAvailDialog] = useState(false);
  const [availDate, setAvailDate] = useState('');
  const [isAvail, setIsAvail] = useState(true);

  useEffect(() => {
    if (profile) {
      setFormData({ fullName: profile.fullName, phone: profile.phone });
    }
  }, [profile]);

  const handleSave = () => {
    if (!/^01[0125][0-9]{8}$/.test(formData.phone)) {
      toast.error('Please enter a valid Egyptian phone number (e.g. 01012345678)');
      return;
    }
    updateMutation.mutate({ data: formData }, {
      onSuccess: () => {
        toast.success('Profile updated');
        setIsEditing(false);
        queryClient.invalidateQueries({ queryKey: getGetMyUsherProfileQueryKey() });
      },
      onError: (err) => toast.error(err.message || 'Update failed')
    });
  };

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        clearAuthToken();
        queryClient.removeQueries();
        setLocation('/login');
      }
    });
  };

  const handleAddSkill = () => {
    if (!newSkillValue) return;
    addSkillMutation.mutate({ data: { skillType: newSkillType, value: newSkillValue } }, {
      onSuccess: () => {
        toast.success('Skill added');
        setNewSkillValue('');
        setShowSkillDialog(false);
        queryClient.invalidateQueries({ queryKey: getListMySkillsQueryKey() });
      }
    });
  };

  const handleDeleteSkill = (id: number) => {
    deleteSkillMutation.mutate({ skillId: id }, {
      onSuccess: () => {
        toast.success('Skill removed');
        queryClient.invalidateQueries({ queryKey: getListMySkillsQueryKey() });
      }
    });
  };

  const handleSetAvail = () => {
    if (!availDate) return;
    setAvailMutation.mutate({ data: { date: availDate, isAvailable: isAvail } }, {
      onSuccess: () => {
        toast.success('Availability updated');
        setShowAvailDialog(false);
        setAvailDate('');
        queryClient.invalidateQueries({ queryKey: getListMyAvailabilityQueryKey() });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-60 w-full rounded-2xl" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="pb-8 relative min-h-screen">
      <div className="pt-6 pb-8 px-5 relative">
        <p className="brand-meta text-secondary mb-1 relative z-10">YOUR FIELD PROFILE</p>
        <h1 className="brand-display text-4xl text-foreground mb-6 relative z-10 uppercase tracking-widest">PROFILE</h1>
      </div>

      <div className="px-5 relative z-10 space-y-5">
        {/* Profile Card */}
        <div className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center relative overflow-hidden shadow-sm">
          <div className="w-24 h-24 rounded-full bg-muted border-4 border-background mb-4 flex items-center justify-center overflow-hidden shadow-sm relative z-10">
            {profile.profilePhotoUrl ? (
              <img src={profile.profilePhotoUrl} alt={profile.fullName} className="w-full h-full object-cover" />
            ) : (
              <User className="w-10 h-10 text-muted-foreground" />
            )}
          </div>

          {isEditing ? (
            <div className="w-full space-y-3 mt-2 relative z-10">
              <Input
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="text-center font-bold text-lg rounded-xl border-border"
              />
              <Input
                value={formData.phone}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  if (val.length <= 11) {
                    setFormData({ ...formData, phone: val });
                  }
                }}
                className="text-center rounded-xl border-border"
                placeholder="Phone Number"
                type="tel"
                inputMode="numeric"
              />
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 rounded-xl text-xs font-bold tracking-widest uppercase" onClick={() => setIsEditing(false)}>CANCEL</Button>
                <Button className="flex-1 rounded-xl text-xs font-bold tracking-widest uppercase" onClick={handleSave} disabled={updateMutation.isPending}>SAVE</Button>
              </div>
            </div>
          ) : (
            <div className="relative z-10 flex flex-col items-center">
              <h2 className="brand-display text-2xl uppercase tracking-wide">{profile.fullName}</h2>
              <div className="flex items-center gap-3 mt-2 mb-5">
                <span className="brand-meta inline-flex items-center px-2 py-1 bg-green-500/10 text-green-600 border border-green-500/20 rounded-md">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> ACTIVE
                </span>
                <span className="flex items-center text-sm font-semibold text-muted-foreground border border-border px-2 py-1 bg-background rounded-md">
                  <Star className="w-4 h-4 text-secondary fill-secondary mr-1" />
                  {profile.avgRating?.toFixed(1) || 'N/A'}
                </span>
              </div>
              <button 
                className="relative flex items-center justify-center w-full h-11 bg-primary text-primary-foreground text-xs font-bold tracking-widest uppercase rounded-xl shadow-[5px_5px_0px_hsl(165,35%,12%)] transition-all duration-300 group hover:text-transparent active:translate-x-[3px] active:translate-y-[3px] active:shadow-[2px_2px_0px_hsl(165,35%,12%)] mt-2"
                onClick={() => setIsEditing(true)}
              >
                <span className="transition-colors duration-300 group-hover:text-transparent">EDIT PROFILE</span>
                <Pencil className="w-4 h-4 absolute right-5 text-primary-foreground transition-all duration-300 group-hover:right-1/2 group-hover:translate-x-1/2" strokeWidth={2.5} />
              </button>
            </div>
          )}
        </div>

        {/* Skills */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4 border-b border-border/50 pb-3">
            <h3 className="brand-display text-lg flex items-center gap-2 uppercase tracking-wide">
              <Settings className="w-5 h-5 text-secondary" /> SKILLS & TRAITS
            </h3>
            <Dialog open={showSkillDialog} onOpenChange={setShowSkillDialog}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-secondary rounded-xl hover:bg-secondary/10">
                  <Plus className="w-5 h-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[90vw] max-w-[400px] rounded-2xl border border-border p-6 bg-card">
                <DialogHeader><DialogTitle className="brand-display text-2xl uppercase tracking-wide">ADD SKILL</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <select
                    className="w-full h-11 px-3 rounded-xl border border-border bg-background text-sm font-medium focus:ring-1 focus:ring-primary outline-none"
                    value={newSkillType}
                    onChange={e => {
                      const type = e.target.value;
                      setNewSkillType(type);
                      setNewSkillValue(SKILL_OPTIONS[type][0]);
                    }}
                  >
                    <option value="language">LANGUAGE</option>
                    <option value="experience">EXPERIENCE</option>
                    <option value="trait">PHYSICAL TRAIT</option>
                  </select>
                  <select
                    className="w-full h-11 px-3 rounded-xl border border-border bg-background text-sm font-medium focus:ring-1 focus:ring-primary outline-none"
                    value={newSkillValue}
                    onChange={e => setNewSkillValue(e.target.value)}
                  >
                    {SKILL_OPTIONS[newSkillType].map(opt => (
                      <option key={opt} value={opt}>{opt.toUpperCase()}</option>
                    ))}
                  </select>
                  <Button className="w-full rounded-xl h-11 text-xs font-bold tracking-widest uppercase" onClick={handleAddSkill} disabled={addSkillMutation.isPending}>ADD</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex flex-wrap gap-2">
            {Array.isArray(skills) && skills.length ? skills.map(skill => (
              <span key={skill.id} className="brand-meta inline-flex items-center px-3 py-1.5 bg-background border border-border rounded-lg">
                {skill.skillType === 'language' ? 'LANGUAGE: ' : ''}
                {skill.value}
                <button onClick={() => handleDeleteSkill(skill.id)} className="ml-2 text-muted-foreground hover:text-destructive transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )) : (
              <p className="text-xs font-medium text-muted-foreground p-3 border border-dashed border-border text-center w-full">NO SKILLS ADDED YET.</p>
            )}
          </div>
        </div>

        {/* Availability */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4 border-b border-border/50 pb-3">
            <h3 className="brand-display text-lg flex items-center gap-2 uppercase tracking-wide">
              <CalendarIcon className="w-5 h-5 text-secondary" /> MY AVAILABILITY
            </h3>
            <Dialog open={showAvailDialog} onOpenChange={setShowAvailDialog}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-secondary rounded-xl hover:bg-secondary/10">
                  <Plus className="w-5 h-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[90vw] max-w-[400px] rounded-2xl border border-border p-6 bg-card">
                <DialogHeader><DialogTitle className="brand-display text-2xl uppercase tracking-wide">SET AVAILABILITY</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <Input type="date" value={availDate} onChange={e => setAvailDate(e.target.value)} className="rounded-xl border-border h-11" />
                  <select
                    className="w-full h-11 px-3 rounded-xl border border-border bg-background text-sm font-medium focus:ring-1 focus:ring-primary outline-none"
                    value={isAvail ? 'true' : 'false'}
                    onChange={e => setIsAvail(e.target.value === 'true')}
                  >
                    <option value="true">AVAILABLE</option>
                    <option value="false">NOT AVAILABLE</option>
                  </select>
                  <Button className="w-full rounded-xl h-11 text-xs font-bold tracking-widest uppercase" onClick={handleSetAvail} disabled={setAvailMutation.isPending}>SAVE</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-2">
            {Array.isArray(availabilities) && availabilities.length ? availabilities.map(av => (
              <div key={av.id} className="flex justify-between items-center bg-background border border-border rounded-xl p-3">
                <span className="text-sm font-bold tracking-wide uppercase">{format(new Date(av.date), 'MMM d, yyyy')}</span>
                <span className={`brand-meta px-2 py-1 border rounded-md ${av.isAvailable ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-destructive/10 text-destructive border-destructive/20'}`}>
                  {av.isAvailable ? 'AVAILABLE' : 'BUSY'}
                </span>
              </div>
            )) : (
              <p className="text-xs font-medium text-muted-foreground p-3 border border-dashed border-border text-center w-full">NO UPCOMING AVAILABILITY DECLARED.</p>
            )}
          </div>
        </div>

        {/* Links */}
        <div className="bg-card border border-border rounded-2xl p-0 overflow-hidden shadow-sm">
          <Link href="/documents" className="flex items-center justify-between p-4 border-b border-border hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-muted-foreground" />
              <span className="brand-meta text-foreground">MY DOCUMENTS</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </Link>
          <Link href="/payouts" className="flex items-center justify-between p-4 border-b border-border hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-muted-foreground" />
              <span className="brand-meta text-foreground">PAYOUT HISTORY</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </Link>
          <Link href="/ratings" className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <Star className="w-5 h-5 text-muted-foreground" />
              <span className="brand-meta text-foreground">MY RATINGS</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </Link>
        </div>

        {/* Logout */}
        <Button variant="ghost" className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive h-12 rounded-xl border border-transparent hover:border-destructive/20 mt-4 text-xs font-bold tracking-widest uppercase transition-colors" onClick={handleLogout} disabled={logoutMutation.isPending}>
          <LogOut className="w-4 h-4 mr-2" />
          SIGN OUT
        </Button>
      </div>
    </div>
  );
}
