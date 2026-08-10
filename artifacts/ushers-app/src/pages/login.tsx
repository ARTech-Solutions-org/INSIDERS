import React, { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useLoginUsher, useGetMe } from '@workspace/api-client-react';
import { setAuthToken } from '@/lib/auth';
import { useQueryClient } from '@tanstack/react-query';
import { getGetMeQueryKey } from '@workspace/api-client-react';
import { toast } from 'sonner';
import { LogIn } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password is required'),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const loginMutation = useLoginUsher();
  
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' }
  });

  const onSubmit = (data: z.infer<typeof loginSchema>) => {
    loginMutation.mutate({ data }, {
      onSuccess: (res) => {
        setAuthToken(res.token);
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast.success('Logged in successfully');
        if (res.usher.status === 'pending') {
          setLocation('/pending');
        } else {
          setLocation('/');
        }
      },
      onError: (err: any) => {
        toast.error(err.message || 'Failed to login. Please check your credentials.');
      }
    });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background p-6">
      <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto">
        <div className="mb-10 text-center">
          <div className="w-16 h-16 bg-secondary mx-auto rounded-xl rotate-45 flex items-center justify-center mb-6 shadow-lg">
            <div className="w-6 h-6 bg-primary rounded-full shadow-inner" />
          </div>
          <h1 className="text-3xl font-bold text-primary tracking-wide mb-2">ARTECH</h1>
          <p className="text-muted-foreground uppercase tracking-widest text-xs font-semibold">Live the Experience</p>
        </div>

        <div className="bg-card rounded-2xl p-6 shadow-xl border border-card-border mb-6">
          <h2 className="text-xl font-bold mb-6 text-foreground">Usher Login</h2>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="name@example.com" {...field} className="bg-background" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} className="bg-background" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full h-12 text-base font-semibold mt-2" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : (
                  <>
                    <LogIn className="w-5 h-5 mr-2" />
                    Sign In
                  </>
                )}
              </Button>
            </form>
          </Form>
        </div>

        <p className="text-center text-muted-foreground text-sm">
          Don't have an account?{' '}
          <Link href="/register" className="text-secondary font-semibold hover:underline">
            Apply Now
          </Link>
        </p>
      </div>
    </div>
  );
}
