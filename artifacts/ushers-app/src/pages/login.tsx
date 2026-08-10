import React from 'react';
import { useLocation, Link } from 'wouter';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/ui/logo';
import { useLoginUsher } from '@workspace/api-client-react';
import { setAuthToken } from '@/lib/auth';
import { useQueryClient } from '@tanstack/react-query';
import { getGetMeQueryKey } from '@workspace/api-client-react';
import { toast } from 'sonner';
import { LogIn, ArrowUpRight } from 'lucide-react';

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
    <div className="min-h-[100dvh] flex flex-col p-5 relative overflow-hidden">
      <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto relative z-10">
        <div className="mb-10 text-center flex flex-col items-center">
          <Logo className="h-24 w-auto" color="foreground" />
        </div>

        <div className="bg-primary p-8 mb-6 relative z-10 overflow-hidden text-primary-foreground shadow-sm rounded-2xl">
          {/* Decorative Pattern Bottom Right */}
          <div 
            className="absolute -right-4 -bottom-4 w-40 h-40 opacity-10 pointer-events-none" 
            style={{ 
              backgroundImage: 'radial-gradient(circle, currentColor 1.5px, transparent 1.5px)', 
              backgroundSize: '12px 12px',
              color: 'hsl(var(--primary-foreground))',
              maskImage: 'radial-gradient(circle at bottom right, black, transparent 70%)',
              WebkitMaskImage: 'radial-gradient(circle at bottom right, black, transparent 70%)'
            }} 
          />
          <div className="relative flex items-center mb-8 z-10 pl-2">
            <div className="absolute left-0 w-3 h-3 rounded-full bg-primary-foreground"></div>
            <div className="absolute left-0 w-3 h-3 rounded-full bg-primary-foreground animate-ping opacity-75"></div>
            <h2 className="brand-display text-2xl tracking-widest uppercase text-primary-foreground ml-6">USHER ACCESS</h2>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 relative z-10">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormControl>
                      <Input type="email" placeholder=" " {...field} className="peer bg-primary-foreground/5 border border-primary-foreground/20 text-primary-foreground rounded-xl h-14 pt-4 pb-1 px-4 outline-none focus-visible:ring-1 focus-visible:ring-primary-foreground focus-visible:border-primary-foreground transition-colors w-full" />
                    </FormControl>
                    <FormLabel className="absolute left-4 transition-all duration-300 pointer-events-none top-1/2 -translate-y-1/2 text-sm text-primary-foreground/60 font-medium peer-focus:top-4 peer-focus:text-[10px] peer-focus:font-bold peer-focus:text-primary-foreground peer-[:not(:placeholder-shown)]:top-4 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:text-primary-foreground/90">
                      Email Address
                    </FormLabel>
                    <FormMessage className="text-red-300 text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormControl>
                      <Input type="password" placeholder=" " {...field} className="peer bg-primary-foreground/5 border border-primary-foreground/20 text-primary-foreground rounded-xl h-14 pt-4 pb-1 px-4 outline-none focus-visible:ring-1 focus-visible:ring-primary-foreground focus-visible:border-primary-foreground transition-colors w-full" />
                    </FormControl>
                    <FormLabel className="absolute left-4 transition-all duration-300 pointer-events-none top-1/2 -translate-y-1/2 text-sm text-primary-foreground/60 font-medium peer-focus:top-4 peer-focus:text-[10px] peer-focus:font-bold peer-focus:text-primary-foreground peer-[:not(:placeholder-shown)]:top-4 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:text-primary-foreground/90">
                      Password
                    </FormLabel>
                    <FormMessage className="text-red-300 text-xs" />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full h-12 mt-6 bg-primary-foreground text-primary hover:bg-primary-foreground/90 rounded-xl text-sm font-bold tracking-widest uppercase shadow-sm transition-transform active:scale-[0.98]" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : (
                  <>
                    SIGN IN <LogIn className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
          </Form>
        </div>

        <p className="text-center brand-meta text-xs">
          DON'T HAVE AN ACCOUNT?{' '}
          <Link href="/register" className="text-foreground font-bold hover:underline border-b border-foreground/30 pb-0.5">
            APPLY NOW
          </Link>
        </p>
      </div>
    </div>
  );
}
