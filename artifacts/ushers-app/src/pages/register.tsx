import React from 'react';
import { useLocation, Link } from 'wouter';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useRegisterUsher } from '@workspace/api-client-react';
import { setAuthToken } from '@/lib/auth';
import { useQueryClient } from '@tanstack/react-query';
import { getGetMeQueryKey } from '@workspace/api-client-react';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';

const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  phone: z.string().min(8, 'Phone number is required'),
  email: z.string().email('Valid email is required'),
  nationalIdNumber: z.string().min(14, 'National ID must be 14 digits').max(14),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export default function Register() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const registerMutation = useRegisterUsher();
  
  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', phone: '', email: '', nationalIdNumber: '', password: '' }
  });

  const onSubmit = (data: z.infer<typeof registerSchema>) => {
    registerMutation.mutate({ data }, {
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
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background p-6">
      <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto py-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-primary tracking-wide mb-1">ARTECH</h1>
          <p className="text-muted-foreground uppercase tracking-widest text-[10px] font-semibold">Join the Team</p>
        </div>

        <div className="bg-card rounded-2xl p-6 shadow-xl border border-card-border mb-6">
          <h2 className="text-xl font-bold mb-6 text-foreground">Apply as an Usher</h2>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="fullName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl><Input placeholder="Ahmed Hassan" {...field} className="bg-background" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl><Input placeholder="01XXXXXXXXX" {...field} className="bg-background" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input type="email" placeholder="ahmed@example.com" {...field} className="bg-background" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="nationalIdNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>National ID (14 digits)</FormLabel>
                  <FormControl><Input placeholder="2901..." {...field} className="bg-background" maxLength={14} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl><Input type="password" placeholder="••••••••" {...field} className="bg-background" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <Button type="submit" className="w-full h-12 text-base font-semibold mt-4" disabled={registerMutation.isPending}>
                {registerMutation.isPending ? <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : (
                  <>
                    <UserPlus className="w-5 h-5 mr-2" />
                    Submit Application
                  </>
                )}
              </Button>
            </form>
          </Form>
        </div>

        <p className="text-center text-muted-foreground text-sm">
          Already have an account?{' '}
          <Link href="/login" className="text-secondary font-semibold hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
