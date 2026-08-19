import React, { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Logo } from '@/components/ui/logo';
import { useRegisterUsher } from '@workspace/api-client-react';
import { setAuthToken } from '@/lib/auth';
import { useQueryClient } from '@tanstack/react-query';
import { getGetMeQueryKey } from '@workspace/api-client-react';
import { toast } from 'sonner';
import { UserPlus, Upload, Image as ImageIcon } from 'lucide-react';

const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  fullNameArabic: z.string().optional(),
  gender: z.enum(['male', 'female']).optional().or(z.literal('')),
  dateOfBirth: z.string().optional(),
  height: z.coerce.number().optional().or(z.literal('')),
  university: z.string().optional(),
  major: z.string().optional(),
  languages: z.array(z.string()).optional(),

  shoeSize: z.string().optional(),
  shirtSize: z.string().optional(),
  tShirtSize: z.string().optional(),
  pantsSize: z.string().optional(),
  shortsSize: z.string().optional(),

  phone: z.string().regex(/^01[0125][0-9]{8}$/, 'Must be a valid Egyptian phone number'),
  email: z.string().email('Valid email is required'),
  nationalIdNumber: z.string().min(14, 'National ID must be 14 digits').max(14),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  
  paymentMethod: z.enum(['instapay', 'ewallet'], { required_error: 'Payment method is required' }),
  paymentMethodDetails: z.string().min(1, 'Payment details are required'),

  profilePhotoFile: z.any().optional(),
  idFrontFile: z.any().optional(),
  idBackFile: z.any().optional(),
});

type FormValues = z.infer<typeof registerSchema>;

function TagInput({ value = [], onChange, placeholder = "Add language..." }: { value: string[], onChange: (v: string[]) => void, placeholder?: string }) {
  const [inputValue, setInputValue] = useState('');
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = inputValue.trim();
      if (newTag && !value.includes(newTag)) {
        onChange([...value, newTag]);
      }
      setInputValue('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter(tag => tag !== tagToRemove));
  };

  return (
    <div className="flex flex-wrap gap-2 items-center bg-primary-foreground/5 border border-primary-foreground/20 rounded-xl p-2 min-h-[56px] focus-within:border-primary-foreground focus-within:ring-1 focus-within:ring-primary-foreground transition-colors">
      {value.map(tag => (
        <span key={tag} className="bg-primary-foreground/20 text-primary-foreground px-2 py-1 rounded-md text-xs flex items-center gap-1 font-medium">
          {tag}
          <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-300 ml-1 transition-colors">&times;</button>
        </span>
      ))}
      <input 
        type="text" 
        className="flex-1 bg-transparent border-none outline-none text-primary-foreground text-sm min-w-[120px] placeholder:text-primary-foreground/50" 
        placeholder={value.length === 0 ? placeholder : ''}
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          const newTag = inputValue.trim();
          if (newTag && !value.includes(newTag)) {
            onChange([...value, newTag]);
          }
          setInputValue('');
        }}
      />
    </div>
  );
}

function FileUpload({ accept, onChange, placeholder }: { accept: string, onChange: (f: File | null) => void, placeholder: string }) {
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div className="relative border border-primary-foreground/20 bg-primary-foreground/5 rounded-xl h-14 flex items-center px-4 overflow-hidden hover:bg-primary-foreground/10 transition-colors group w-full">
      <input 
        type="file" 
        accept={accept}
        className="absolute inset-0 opacity-0 cursor-pointer z-10"
        onChange={e => {
          const file = e.target.files?.[0] || null;
          onChange(file);
          setFileName(file ? file.name : null);
        }}
      />
      <Upload className="w-5 h-5 shrink-0 text-primary-foreground/60 mr-3 group-hover:text-primary-foreground transition-colors" />
      <span className="flex-1 min-w-0 text-sm text-primary-foreground/80 truncate pointer-events-none group-hover:text-primary-foreground transition-colors">
        {fileName || placeholder}
      </span>
    </div>
  );
}

const uploadToR2 = async (file: File, type: string) => {
  const res = await fetch('/api/uploads/presigned-url', {
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
  
  return { url: url.split('?')[0], key };
};

export default function Register() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const registerMutation = useRegisterUsher();
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { 
      fullName: '', fullNameArabic: '', phone: '', email: '', nationalIdNumber: '', password: '', 
      paymentMethod: 'instapay', paymentMethodDetails: '',
      university: '', major: '', shoeSize: '', shirtSize: '', tShirtSize: '', pantsSize: '', shortsSize: '',
      languages: []
    }
  });

  const onSubmit = async (data: FormValues) => {
    try {
      setIsUploading(true);
      
      let profilePhotoUrl, profilePhotoKey;
      if (data.profilePhotoFile instanceof File) {
        toast.loading('Uploading profile photo...', { id: 'upload' });
        const res = await uploadToR2(data.profilePhotoFile, 'profilePhoto');
        profilePhotoUrl = res.url;
        profilePhotoKey = res.key;
      }

      let nationalIdDocUrl, nationalIdDocKey;
      if (data.idFrontFile instanceof File) {
        toast.loading('Uploading ID front...', { id: 'upload' });
        const res = await uploadToR2(data.idFrontFile, 'idDocumentFront');
        nationalIdDocUrl = res.url;
        nationalIdDocKey = res.key;
      }

      let nationalIdDocBackUrl, nationalIdDocBackKey;
      if (data.idBackFile instanceof File) {
        toast.loading('Uploading ID back...', { id: 'upload' });
        const res = await uploadToR2(data.idBackFile, 'idDocumentBack');
        nationalIdDocBackUrl = res.url;
        nationalIdDocBackKey = res.key;
      }
      
      toast.dismiss('upload');
      
      const payload = {
        fullName: data.fullName,
        fullNameArabic: data.fullNameArabic || undefined,
        phone: data.phone,
        email: data.email,
        nationalIdNumber: data.nationalIdNumber,
        password: data.password,
        paymentMethod: data.paymentMethod,
        paymentMethodDetails: data.paymentMethodDetails,
        gender: data.gender === '' ? undefined : (data.gender as 'male' | 'female' | undefined),
        dateOfBirth: data.dateOfBirth || undefined,
        height: typeof data.height === 'number' ? data.height : undefined,
        university: data.university || undefined,
        major: data.major || undefined,
        languages: data.languages && data.languages.length > 0 ? data.languages : undefined,
        shoeSize: data.shoeSize || undefined,
        shirtSize: data.shirtSize || undefined,
        tShirtSize: data.tShirtSize || undefined,
        pantsSize: data.pantsSize || undefined,
        shortsSize: data.shortsSize || undefined,
        profilePhotoUrl,
        profilePhotoKey,
        nationalIdDocUrl,
        nationalIdDocKey,
        nationalIdDocBackUrl,
        nationalIdDocBackKey,
      };

      registerMutation.mutate({ data: payload }, {
        onSuccess: (res) => {
          setAuthToken(res.token);
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          toast.success('Registration submitted');
          setLocation('/pending');
        },
        onError: (err: any) => {
          toast.error(err.message || 'Failed to register. Please check your inputs.');
        }
      });
    } catch (e: any) {
      toast.dismiss('upload');
      toast.error(e.message || 'An error occurred during file upload');
    } finally {
      setIsUploading(false);
    }
  };

  const isPending = registerMutation.isPending || isUploading;

  return (
    <div className="min-h-[100dvh] flex flex-col p-5 relative overflow-hidden bg-background selection:bg-primary-foreground/30">
      <div className="flex-1 flex flex-col w-full max-w-4xl mx-auto py-8 relative z-10">
        <div className="mb-10 text-center flex flex-col items-center">
          <Logo className="h-16 w-auto mb-4" color="foreground" />
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground brand-display uppercase">Create Your Usher Profile</h1>
          <p className="text-foreground/60 mt-2">Join the floor and start accepting event requests.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 relative z-10 pb-20">
            
            <div className="grid md:grid-cols-2 gap-8">
              
              {/* Left Column */}
              <div className="space-y-8 min-w-0">
                
                {/* Profile Photo */}
                <div className="bg-primary p-6 md:p-8 rounded-3xl relative overflow-hidden text-primary-foreground shadow-sm">
                  <div className="absolute -right-4 -bottom-4 w-40 h-40 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, currentColor 1.5px, transparent 1.5px)', backgroundSize: '12px 12px', color: 'hsl(var(--primary-foreground))', maskImage: 'radial-gradient(circle at bottom right, black, transparent 70%)', WebkitMaskImage: 'radial-gradient(circle at bottom right, black, transparent 70%)' }} />
                  <h3 className="text-lg font-bold tracking-widest uppercase mb-4 flex items-center gap-2"><ImageIcon className="w-5 h-5 opacity-70" /> Profile Photo</h3>
                  <FormField control={form.control} name="profilePhotoFile" render={({ field }) => (
                    <FormItem>
                      <FormControl><FileUpload accept="image/jpeg, image/png" placeholder="Upload Profile Photo (Max 3MB)" onChange={field.onChange} /></FormControl>
                      <FormDescription className="text-xs text-primary-foreground/60">For your ID badge and client-facing profile.</FormDescription>
                      <FormMessage className="text-red-300 text-xs" />
                    </FormItem>
                  )} />
                </div>

                {/* Personal Information */}
                <div className="bg-primary p-6 md:p-8 rounded-3xl relative overflow-hidden text-primary-foreground shadow-sm">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-primary-foreground rounded-r-full opacity-50" />
                  <h3 className="text-lg font-bold tracking-widest uppercase mb-6">Personal Information</h3>
                  <div className="space-y-4">
                    <FormField control={form.control} name="fullName" render={({ field }) => (
                      <FormItem className="relative"><FormControl><Input placeholder=" " {...field} className="peer bg-primary-foreground/5 border border-primary-foreground/20 text-primary-foreground rounded-xl h-14 pt-4 pb-1 px-4 outline-none focus-visible:ring-1 focus-visible:ring-primary-foreground focus-visible:border-primary-foreground transition-colors w-full" /></FormControl><FormLabel className="absolute left-4 transition-all duration-300 pointer-events-none top-1/2 -translate-y-1/2 text-sm text-primary-foreground/60 font-medium peer-focus:top-4 peer-focus:text-[10px] peer-focus:font-bold peer-focus:text-primary-foreground peer-[:not(:placeholder-shown)]:top-4 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:text-primary-foreground/90">Full Name (English)</FormLabel><FormMessage className="text-red-300 text-xs" /></FormItem>
                    )} />
                    <FormField control={form.control} name="fullNameArabic" render={({ field }) => (
                      <FormItem className="relative"><FormControl><Input placeholder=" " dir="rtl" {...field} className="peer bg-primary-foreground/5 border border-primary-foreground/20 text-primary-foreground rounded-xl h-14 pt-4 pb-1 px-4 outline-none focus-visible:ring-1 focus-visible:ring-primary-foreground focus-visible:border-primary-foreground transition-colors w-full text-right" /></FormControl><FormLabel className="absolute right-4 transition-all duration-300 pointer-events-none top-1/2 -translate-y-1/2 text-sm text-primary-foreground/60 font-medium peer-focus:top-4 peer-focus:text-[10px] peer-focus:font-bold peer-focus:text-primary-foreground peer-[:not(:placeholder-shown)]:top-4 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:text-primary-foreground/90">Full Name (Arabic)</FormLabel><FormMessage className="text-red-300 text-xs" /></FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="gender" render={({ field }) => (
                        <FormItem><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="bg-primary-foreground/5 border-primary-foreground/20 text-primary-foreground rounded-xl h-14"><SelectValue placeholder="Gender" /></SelectTrigger></FormControl><SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem></SelectContent></Select><FormMessage className="text-red-300 text-xs" /></FormItem>
                      )} />
                      <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
                        <FormItem className="relative"><FormControl><Input type="date" placeholder=" " {...field} className="peer bg-primary-foreground/5 border border-primary-foreground/20 text-primary-foreground rounded-xl h-14 pt-4 pb-1 px-4 outline-none focus-visible:ring-1 focus-visible:ring-primary-foreground focus-visible:border-primary-foreground transition-colors w-full [color-scheme:dark]" /></FormControl><FormLabel className="absolute left-4 transition-all duration-300 pointer-events-none top-4 text-[10px] font-bold text-primary-foreground/90">Date of Birth</FormLabel><FormMessage className="text-red-300 text-xs" /></FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="height" render={({ field }) => (
                        <FormItem className="relative"><FormControl><Input type="number" placeholder=" " {...field} className="peer bg-primary-foreground/5 border border-primary-foreground/20 text-primary-foreground rounded-xl h-14 pt-4 pb-1 px-4 outline-none focus-visible:ring-1 focus-visible:ring-primary-foreground focus-visible:border-primary-foreground transition-colors w-full" /></FormControl><FormLabel className="absolute left-4 transition-all duration-300 pointer-events-none top-1/2 -translate-y-1/2 text-sm text-primary-foreground/60 font-medium peer-focus:top-4 peer-focus:text-[10px] peer-focus:font-bold peer-focus:text-primary-foreground peer-[:not(:placeholder-shown)]:top-4 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:text-primary-foreground/90">Height (cm)</FormLabel><FormMessage className="text-red-300 text-xs" /></FormItem>
                      )} />
                      <FormField control={form.control} name="university" render={({ field }) => (
                        <FormItem className="relative"><FormControl><Input placeholder=" " {...field} className="peer bg-primary-foreground/5 border border-primary-foreground/20 text-primary-foreground rounded-xl h-14 pt-4 pb-1 px-4 outline-none focus-visible:ring-1 focus-visible:ring-primary-foreground focus-visible:border-primary-foreground transition-colors w-full" /></FormControl><FormLabel className="absolute left-4 transition-all duration-300 pointer-events-none top-1/2 -translate-y-1/2 text-sm text-primary-foreground/60 font-medium peer-focus:top-4 peer-focus:text-[10px] peer-focus:font-bold peer-focus:text-primary-foreground peer-[:not(:placeholder-shown)]:top-4 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:text-primary-foreground/90">University / College</FormLabel><FormMessage className="text-red-300 text-xs" /></FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="major" render={({ field }) => (
                      <FormItem className="relative"><FormControl><Input placeholder=" " {...field} className="peer bg-primary-foreground/5 border border-primary-foreground/20 text-primary-foreground rounded-xl h-14 pt-4 pb-1 px-4 outline-none focus-visible:ring-1 focus-visible:ring-primary-foreground focus-visible:border-primary-foreground transition-colors w-full" /></FormControl><FormLabel className="absolute left-4 transition-all duration-300 pointer-events-none top-1/2 -translate-y-1/2 text-sm text-primary-foreground/60 font-medium peer-focus:top-4 peer-focus:text-[10px] peer-focus:font-bold peer-focus:text-primary-foreground peer-[:not(:placeholder-shown)]:top-4 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:text-primary-foreground/90">Major / Field of Study</FormLabel><FormMessage className="text-red-300 text-xs" /></FormItem>
                    )} />
                    <FormField control={form.control} name="languages" render={({ field }) => (
                      <FormItem><FormLabel className="text-primary-foreground/80 text-sm ml-1">Languages</FormLabel><FormControl><TagInput placeholder="+ Add Language (e.g. English, Arabic)" value={field.value || []} onChange={field.onChange} /></FormControl><FormMessage className="text-red-300 text-xs" /></FormItem>
                    )} />
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-8 min-w-0">
                
                {/* Uniform Sizes */}
                <div className="bg-primary-foreground/5 border border-primary-foreground/10 p-6 md:p-8 rounded-3xl relative overflow-hidden">
                  <h3 className="text-lg font-bold tracking-widest uppercase mb-6 text-foreground/90">Uniform Sizes</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="shirtSize" render={({ field }) => (
                      <FormItem><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="bg-background border-border text-foreground rounded-xl h-14"><SelectValue placeholder="Shirt Size" /></SelectTrigger></FormControl><SelectContent><SelectItem value="XS">XS</SelectItem><SelectItem value="S">S</SelectItem><SelectItem value="M">M</SelectItem><SelectItem value="L">L</SelectItem><SelectItem value="XL">XL</SelectItem><SelectItem value="XXL">XXL</SelectItem></SelectContent></Select><FormMessage className="text-red-500 text-xs" /></FormItem>
                    )} />
                    <FormField control={form.control} name="tShirtSize" render={({ field }) => (
                      <FormItem><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="bg-background border-border text-foreground rounded-xl h-14"><SelectValue placeholder="T-Shirt Size" /></SelectTrigger></FormControl><SelectContent><SelectItem value="XS">XS</SelectItem><SelectItem value="S">S</SelectItem><SelectItem value="M">M</SelectItem><SelectItem value="L">L</SelectItem><SelectItem value="XL">XL</SelectItem><SelectItem value="XXL">XXL</SelectItem></SelectContent></Select><FormMessage className="text-red-500 text-xs" /></FormItem>
                    )} />
                    <FormField control={form.control} name="pantsSize" render={({ field }) => (
                      <FormItem><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="bg-background border-border text-foreground rounded-xl h-14"><SelectValue placeholder="Pants Size" /></SelectTrigger></FormControl><SelectContent><SelectItem value="28">28</SelectItem><SelectItem value="30">30</SelectItem><SelectItem value="32">32</SelectItem><SelectItem value="34">34</SelectItem><SelectItem value="36">36</SelectItem><SelectItem value="38">38</SelectItem><SelectItem value="40">40</SelectItem><SelectItem value="42">42</SelectItem></SelectContent></Select><FormMessage className="text-red-500 text-xs" /></FormItem>
                    )} />
                    <FormField control={form.control} name="shortsSize" render={({ field }) => (
                      <FormItem><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="bg-background border-border text-foreground rounded-xl h-14"><SelectValue placeholder="Shorts Size" /></SelectTrigger></FormControl><SelectContent><SelectItem value="28">28</SelectItem><SelectItem value="30">30</SelectItem><SelectItem value="32">32</SelectItem><SelectItem value="34">34</SelectItem><SelectItem value="36">36</SelectItem><SelectItem value="38">38</SelectItem><SelectItem value="40">40</SelectItem><SelectItem value="42">42</SelectItem></SelectContent></Select><FormMessage className="text-red-500 text-xs" /></FormItem>
                    )} />
                    <FormField control={form.control} name="shoeSize" render={({ field }) => (
                      <FormItem className="col-span-2"><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="bg-background border-border text-foreground rounded-xl h-14"><SelectValue placeholder="Shoe Size (EU)" /></SelectTrigger></FormControl><SelectContent><SelectItem value="36">36</SelectItem><SelectItem value="37">37</SelectItem><SelectItem value="38">38</SelectItem><SelectItem value="39">39</SelectItem><SelectItem value="40">40</SelectItem><SelectItem value="41">41</SelectItem><SelectItem value="42">42</SelectItem><SelectItem value="43">43</SelectItem><SelectItem value="44">44</SelectItem><SelectItem value="45">45</SelectItem><SelectItem value="46">46</SelectItem></SelectContent></Select><FormMessage className="text-red-500 text-xs" /></FormItem>
                    )} />
                  </div>
                </div>

                {/* ID Documents */}
                <div className="bg-primary-foreground/5 border border-primary-foreground/10 p-6 md:p-8 rounded-3xl relative overflow-hidden">
                  <h3 className="text-lg font-bold tracking-widest uppercase mb-6 text-foreground/90">ID Documents</h3>
                  <div className="space-y-4">
                    <FormField control={form.control} name="idFrontFile" render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative border border-border bg-background rounded-xl h-14 flex items-center px-4 overflow-hidden hover:bg-muted/50 transition-colors group w-full">
                            <input type="file" accept="image/jpeg, image/png, application/pdf" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={e => { field.onChange(e.target.files?.[0] || null); }} />
                            <Upload className="w-5 h-5 shrink-0 text-muted-foreground mr-3 group-hover:text-foreground transition-colors" />
                            <span className="flex-1 min-w-0 text-sm text-foreground/80 truncate pointer-events-none group-hover:text-foreground transition-colors">{field.value instanceof File ? field.value.name : "Upload National ID (Front)"}</span>
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-500 text-xs" />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="idBackFile" render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative border border-border bg-background rounded-xl h-14 flex items-center px-4 overflow-hidden hover:bg-muted/50 transition-colors group w-full">
                            <input type="file" accept="image/jpeg, image/png, application/pdf" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={e => { field.onChange(e.target.files?.[0] || null); }} />
                            <Upload className="w-5 h-5 shrink-0 text-muted-foreground mr-3 group-hover:text-foreground transition-colors" />
                            <span className="flex-1 min-w-0 text-sm text-foreground/80 truncate pointer-events-none group-hover:text-foreground transition-colors">{field.value instanceof File ? field.value.name : "Upload National ID (Back)"}</span>
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-500 text-xs" />
                      </FormItem>
                    )} />
                  </div>
                </div>

                {/* Account & Contact */}
                <div className="bg-primary-foreground/5 border border-primary-foreground/10 p-6 md:p-8 rounded-3xl relative overflow-hidden">
                  <h3 className="text-lg font-bold tracking-widest uppercase mb-6 text-foreground/90">Account & Contact</h3>
                  <div className="space-y-4">
                    <FormField control={form.control} name="nationalIdNumber" render={({ field }) => (
                      <FormItem className="relative"><FormControl><Input placeholder=" " {...field} className="peer bg-background border border-border text-foreground rounded-xl h-14 pt-4 pb-1 px-4 outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-colors w-full" maxLength={14} /></FormControl><FormLabel className="absolute left-4 transition-all duration-300 pointer-events-none top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium peer-focus:top-4 peer-focus:text-[10px] peer-focus:font-bold peer-focus:text-foreground peer-[:not(:placeholder-shown)]:top-4 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:text-foreground/90">National ID Number</FormLabel><FormMessage className="text-red-500 text-xs" /></FormItem>
                    )} />
                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem className="relative"><FormControl><Input placeholder=" " {...field} className="peer bg-background border border-border text-foreground rounded-xl h-14 pt-4 pb-1 px-4 outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-colors w-full" /></FormControl><FormLabel className="absolute left-4 transition-all duration-300 pointer-events-none top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium peer-focus:top-4 peer-focus:text-[10px] peer-focus:font-bold peer-focus:text-foreground peer-[:not(:placeholder-shown)]:top-4 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:text-foreground/90">Phone Number</FormLabel><FormMessage className="text-red-500 text-xs" /></FormItem>
                    )} />
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem className="relative"><FormControl><Input type="email" placeholder=" " {...field} className="peer bg-background border border-border text-foreground rounded-xl h-14 pt-4 pb-1 px-4 outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-colors w-full" /></FormControl><FormLabel className="absolute left-4 transition-all duration-300 pointer-events-none top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium peer-focus:top-4 peer-focus:text-[10px] peer-focus:font-bold peer-focus:text-foreground peer-[:not(:placeholder-shown)]:top-4 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:text-foreground/90">Email Address</FormLabel><FormMessage className="text-red-500 text-xs" /></FormItem>
                    )} />
                    <FormField control={form.control} name="password" render={({ field }) => (
                      <FormItem className="relative"><FormControl><Input type="password" placeholder=" " {...field} className="peer bg-background border border-border text-foreground rounded-xl h-14 pt-4 pb-1 px-4 outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-colors w-full" /></FormControl><FormLabel className="absolute left-4 transition-all duration-300 pointer-events-none top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium peer-focus:top-4 peer-focus:text-[10px] peer-focus:font-bold peer-focus:text-foreground peer-[:not(:placeholder-shown)]:top-4 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:text-foreground/90">Password</FormLabel><FormMessage className="text-red-500 text-xs" /></FormItem>
                    )} />
                  </div>
                </div>

                {/* Payment Method */}
                <div className="bg-primary-foreground/5 border border-primary-foreground/10 p-6 md:p-8 rounded-3xl relative overflow-hidden">
                  <h3 className="text-lg font-bold tracking-widest uppercase mb-6 text-foreground/90">Payment Details</h3>
                  <div className="space-y-4">
                    <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                      <FormItem>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-background border-border text-foreground rounded-xl h-14">
                              <SelectValue placeholder="Select Payment Method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="instapay">InstaPay</SelectItem>
                            <SelectItem value="ewallet">E-Wallet (Vodafone Cash, etc.)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-red-500 text-xs" />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="paymentMethodDetails" render={({ field }) => (
                      <FormItem className="relative mt-4">
                        <FormControl>
                          <Input placeholder=" " {...field} className="peer bg-background border border-border text-foreground rounded-xl h-14 pt-4 pb-1 px-4 outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-colors w-full" />
                        </FormControl>
                        <FormLabel className="absolute left-4 transition-all duration-300 pointer-events-none top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium peer-focus:top-4 peer-focus:text-[10px] peer-focus:font-bold peer-focus:text-foreground peer-[:not(:placeholder-shown)]:top-4 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:text-foreground/90">
                          {form.watch('paymentMethod') === 'instapay' ? 'InstaPay Username / Link' : 'Wallet Phone Number'}
                        </FormLabel>
                        {form.watch('paymentMethod') === 'instapay' && (
                          <FormDescription className="text-xs text-muted-foreground mt-1 ml-1 leading-tight">
                            To get your link: Open InstaPay &gt; Tap your profile &gt; Copy payment link. Or just write your InstaPay address (e.g., name@instapay).
                          </FormDescription>
                        )}
                        <FormMessage className="text-red-500 text-xs" />
                      </FormItem>
                    )} />
                  </div>
                </div>

              </div>
            </div>

            <div className="flex flex-col items-center max-w-md mx-auto pt-8">
              <Button type="submit" className="w-full h-14 bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl text-base font-bold tracking-widest uppercase shadow-xl transition-all active:scale-[0.98]" disabled={isPending}>
                {isPending ? <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : (
                  <>SUBMIT APPLICATION <UserPlus className="w-5 h-5 ml-2" /></>
                )}
              </Button>
              
              <p className="text-center brand-meta text-xs mt-6 text-foreground/60">
                ALREADY HAVE AN ACCOUNT?{' '}
                <Link href="/login" className="text-foreground font-bold hover:text-primary transition-colors border-b border-foreground/30 hover:border-primary pb-0.5 ml-1">
                  SIGN IN
                </Link>
              </p>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
