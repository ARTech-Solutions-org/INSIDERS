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
import { User, Phone, Mail, CreditCard, ChevronRight, LogOut, Star, CheckCircle2, Shield, Settings, Plus, X, Calendar as CalendarIcon } from 'lucide-react';
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

  // Skill state
  const [newSkillType, setNewSkillType] = useState('language');
  const [newSkillValue, setNewSkillValue] = useState('');
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
    <div className="pb-8">
      <div className="bg-primary pt-6 pb-20 px-6 rounded-b-[40px] shadow-lg relative">
        <div className="absolute right-10 top-10 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
        <h1 className="text-2xl font-bold text-primary-foreground mb-6">Profile</h1>
      </div>

      <div className="px-4 -mt-16 relative z-10 space-y-4">
        {/* Profile Card */}
        <div className="bg-card border border-border p-5 rounded-3xl shadow-xl flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-muted border-4 border-card -mt-16 mb-3 flex items-center justify-center overflow-hidden shadow-sm">
            {profile.profilePhotoUrl ? (
              <img src={profile.profilePhotoUrl} alt={profile.fullName} className="w-full h-full object-cover" />
            ) : (
              <User className="w-10 h-10 text-muted-foreground" />
            )}
          </div>
          
          {isEditing ? (
            <div className="w-full space-y-3 mt-2">
              <Input 
                value={formData.fullName} 
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="text-center font-bold text-lg"
              />
              <Input 
                value={formData.phone} 
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="text-center"
              />
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setIsEditing(false)}>Cancel</Button>
                <Button className="flex-1" onClick={handleSave} disabled={updateMutation.isPending}>Save</Button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold">{profile.fullName}</h2>
              <div className="flex items-center gap-2 mt-1 mb-4">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-green-500/10 text-green-600">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Active
                </span>
                <span className="flex items-center text-sm font-semibold text-muted-foreground">
                  <Star className="w-4 h-4 text-secondary fill-secondary mr-1" />
                  {profile.avgRating?.toFixed(1) || 'N/A'}
                </span>
              </div>
              <Button variant="outline" size="sm" className="w-full rounded-xl" onClick={() => setIsEditing(true)}>
                Edit Profile
              </Button>
            </>
          )}
        </div>

        {/* Skills */}
        <div className="bg-card border border-border rounded-2xl shadow-sm p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Settings className="w-5 h-5 text-secondary" /> Skills & Traits
            </h3>
            <Dialog open={showSkillDialog} onOpenChange={setShowSkillDialog}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-secondary">
                  <Plus className="w-5 h-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[90vw] max-w-[400px] rounded-2xl">
                <DialogHeader><DialogTitle>Add Skill</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <select 
                    className="w-full h-10 px-3 rounded-md border border-input bg-background" 
                    value={newSkillType} 
                    onChange={e => setNewSkillType(e.target.value)}
                  >
                    <option value="language">Language</option>
                    <option value="experience">Experience</option>
                    <option value="trait">Physical Trait (e.g. Height)</option>
                  </select>
                  <Input placeholder="e.g. English, 180cm, VIP Handling" value={newSkillValue} onChange={e => setNewSkillValue(e.target.value)} />
                  <Button className="w-full" onClick={handleAddSkill} disabled={addSkillMutation.isPending}>Add</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {Array.isArray(skills) && skills.length ? skills.map(skill => (
              <span key={skill.id} className="inline-flex items-center px-3 py-1 bg-muted text-sm font-medium rounded-full">
                {skill.skillType === 'language' ? '🗣 ' : ''}
                {skill.value}
                <button onClick={() => handleDeleteSkill(skill.id)} className="ml-2 text-muted-foreground hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )) : (
              <p className="text-sm text-muted-foreground">No skills added yet.</p>
            )}
          </div>
        </div>

        {/* Availability */}
        <div className="bg-card border border-border rounded-2xl shadow-sm p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-secondary" /> My Availability
            </h3>
            <Dialog open={showAvailDialog} onOpenChange={setShowAvailDialog}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-secondary">
                  <Plus className="w-5 h-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[90vw] max-w-[400px] rounded-2xl">
                <DialogHeader><DialogTitle>Set Availability</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <Input type="date" value={availDate} onChange={e => setAvailDate(e.target.value)} />
                  <select 
                    className="w-full h-10 px-3 rounded-md border border-input bg-background" 
                    value={isAvail ? 'true' : 'false'} 
                    onChange={e => setIsAvail(e.target.value === 'true')}
                  >
                    <option value="true">Available</option>
                    <option value="false">Not Available</option>
                  </select>
                  <Button className="w-full" onClick={handleSetAvail} disabled={setAvailMutation.isPending}>Save</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="space-y-2">
            {Array.isArray(availabilities) && availabilities.length ? availabilities.map(av => (
              <div key={av.id} className="flex justify-between items-center bg-muted/50 p-2 rounded-lg">
                <span className="text-sm font-medium">{format(new Date(av.date), 'MMM d, yyyy')}</span>
                <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-md ${av.isAvailable ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'}`}>
                  {av.isAvailable ? 'Available' : 'Busy'}
                </span>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">No upcoming availability declared.</p>
            )}
          </div>
        </div>

        {/* Links */}
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <Link href="/documents" className="flex items-center justify-between p-4 border-b border-border hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium">My Documents</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </Link>
          <Link href="/payouts" className="flex items-center justify-between p-4 border-b border-border hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium">Payout History</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </Link>
          <Link href="/ratings" className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <Star className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium">My Ratings</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </Link>
        </div>

        {/* Logout */}
        <Button variant="ghost" className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive h-14 rounded-2xl mt-4" onClick={handleLogout} disabled={logoutMutation.isPending}>
          <LogOut className="w-5 h-5 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
