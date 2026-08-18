import React from 'react';
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
import { UserPlus, ArrowUpRight } from 'lucide-react';

const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  phone: z.string().regex(/^01[0125][0-9]{8}$/, 'Must be a valid Egyptian phone number (e.g., 01012345678)'),
  email: z.string().email('Valid email is required'),
  nationalIdNumber: z.string().min(14, 'National ID must be 14 digits').max(14),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  paymentMethod: z.enum(['instapay', 'ewallet'], { required_error: 'Payment method is required' }),
  paymentMethodDetails: z.string().min(1, 'Payment details are required'),
});

export default function Register() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const registerMutation = useRegisterUsher();

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', phone: '', email: '', nationalIdNumber: '', password: '', paymentMethod: 'instapay', paymentMethodDetails: '' }
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
    <div className="min-h-[100dvh] flex flex-col p-5 relative overflow-hidden">
      <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto py-8 relative z-10">
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
            <h2 className="brand-display text-2xl tracking-widest uppercase text-primary-foreground ml-6">JOIN THE FLOOR</h2>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 relative z-10">
              <FormField control={form.control} name="fullName" render={({ field }) => (
                <FormItem className="relative">
                  <FormControl><Input placeholder=" " {...field} className="peer bg-primary-foreground/5 border border-primary-foreground/20 text-primary-foreground rounded-xl h-14 pt-4 pb-1 px-4 outline-none focus-visible:ring-1 focus-visible:ring-primary-foreground focus-visible:border-primary-foreground transition-colors w-full" /></FormControl>
                  <FormLabel className="absolute left-4 transition-all duration-300 pointer-events-none top-1/2 -translate-y-1/2 text-sm text-primary-foreground/60 font-medium peer-focus:top-4 peer-focus:text-[10px] peer-focus:font-bold peer-focus:text-primary-foreground peer-[:not(:placeholder-shown)]:top-4 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:text-primary-foreground/90">Full Name</FormLabel>
                  <FormMessage className="text-red-300 text-xs" />
                </FormItem>
              )} />

              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem className="relative">
                  <FormControl><Input placeholder=" " {...field} className="peer bg-primary-foreground/5 border border-primary-foreground/20 text-primary-foreground rounded-xl h-14 pt-4 pb-1 px-4 outline-none focus-visible:ring-1 focus-visible:ring-primary-foreground focus-visible:border-primary-foreground transition-colors w-full" /></FormControl>
                  <FormLabel className="absolute left-4 transition-all duration-300 pointer-events-none top-1/2 -translate-y-1/2 text-sm text-primary-foreground/60 font-medium peer-focus:top-4 peer-focus:text-[10px] peer-focus:font-bold peer-focus:text-primary-foreground peer-[:not(:placeholder-shown)]:top-4 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:text-primary-foreground/90">Phone Number</FormLabel>
                  <FormMessage className="text-red-300 text-xs" />
                </FormItem>
              )} />

              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem className="relative">
                  <FormControl><Input type="email" placeholder=" " {...field} className="peer bg-primary-foreground/5 border border-primary-foreground/20 text-primary-foreground rounded-xl h-14 pt-4 pb-1 px-4 outline-none focus-visible:ring-1 focus-visible:ring-primary-foreground focus-visible:border-primary-foreground transition-colors w-full" /></FormControl>
                  <FormLabel className="absolute left-4 transition-all duration-300 pointer-events-none top-1/2 -translate-y-1/2 text-sm text-primary-foreground/60 font-medium peer-focus:top-4 peer-focus:text-[10px] peer-focus:font-bold peer-focus:text-primary-foreground peer-[:not(:placeholder-shown)]:top-4 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:text-primary-foreground/90">Email Address</FormLabel>
                  <FormMessage className="text-red-300 text-xs" />
                </FormItem>
              )} />

              <FormField control={form.control} name="nationalIdNumber" render={({ field }) => (
                <FormItem className="relative">
                  <FormControl><Input placeholder=" " {...field} className="peer bg-primary-foreground/5 border border-primary-foreground/20 text-primary-foreground rounded-xl h-14 pt-4 pb-1 px-4 outline-none focus-visible:ring-1 focus-visible:ring-primary-foreground focus-visible:border-primary-foreground transition-colors w-full" maxLength={14} /></FormControl>
                  <FormLabel className="absolute left-4 transition-all duration-300 pointer-events-none top-1/2 -translate-y-1/2 text-sm text-primary-foreground/60 font-medium peer-focus:top-4 peer-focus:text-[10px] peer-focus:font-bold peer-focus:text-primary-foreground peer-[:not(:placeholder-shown)]:top-4 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:text-primary-foreground/90">National ID</FormLabel>
                  <FormMessage className="text-red-300 text-xs" />
                </FormItem>
              )} />

              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem className="relative">
                  <FormControl><Input type="password" placeholder=" " {...field} className="peer bg-primary-foreground/5 border border-primary-foreground/20 text-primary-foreground rounded-xl h-14 pt-4 pb-1 px-4 outline-none focus-visible:ring-1 focus-visible:ring-primary-foreground focus-visible:border-primary-foreground transition-colors w-full" /></FormControl>
                  <FormLabel className="absolute left-4 transition-all duration-300 pointer-events-none top-1/2 -translate-y-1/2 text-sm text-primary-foreground/60 font-medium peer-focus:top-4 peer-focus:text-[10px] peer-focus:font-bold peer-focus:text-primary-foreground peer-[:not(:placeholder-shown)]:top-4 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:text-primary-foreground/90">Password</FormLabel>
                  <FormMessage className="text-red-300 text-xs" />
                </FormItem>
              )} />

              <div className="bg-primary-foreground/5 p-4 rounded-xl border border-primary-foreground/10 space-y-4 mt-2">
                <h3 className="text-sm font-bold text-primary-foreground/90 tracking-widest uppercase">Payment Method</h3>
                
                <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                  <FormItem>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-transparent border-primary-foreground/20 text-primary-foreground rounded-xl h-12">
                          <SelectValue placeholder="Select Payment Method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="instapay">InstaPay</SelectItem>
                        <SelectItem value="ewallet">E-Wallet (Vodafone Cash, etc.)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-red-300 text-xs" />
                  </FormItem>
                )} />

                <FormField control={form.control} name="paymentMethodDetails" render={({ field }) => (
                  <FormItem className="relative mt-4">
                    <FormControl>
                      <Input 
                        placeholder=" " 
                        {...field} 
                        className="peer bg-primary-foreground/5 border border-primary-foreground/20 text-primary-foreground rounded-xl h-14 pt-4 pb-1 px-4 outline-none focus-visible:ring-1 focus-visible:ring-primary-foreground focus-visible:border-primary-foreground transition-colors w-full" 
                      />
                    </FormControl>
                    <FormLabel className="absolute left-4 transition-all duration-300 pointer-events-none top-1/2 -translate-y-1/2 text-sm text-primary-foreground/60 font-medium peer-focus:top-4 peer-focus:text-[10px] peer-focus:font-bold peer-focus:text-primary-foreground peer-[:not(:placeholder-shown)]:top-4 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:text-primary-foreground/90">
                      {form.watch('paymentMethod') === 'instapay' ? 'InstaPay Username / Link' : 'Wallet Phone Number'}
                    </FormLabel>
                    {form.watch('paymentMethod') === 'instapay' && (
                      <FormDescription className="text-[10px] text-primary-foreground/60 mt-1 ml-1 leading-tight">
                        To get your link: Open InstaPay &gt; Tap your profile &gt; Copy payment link. Or just write your InstaPay address (e.g., name@instapay).
                      </FormDescription>
                    )}
                    <FormMessage className="text-red-300 text-xs" />
                  </FormItem>
                )} />
              </div>

              <Button type="submit" className="w-full h-12 mt-6 bg-primary-foreground text-primary hover:bg-primary-foreground/90 rounded-xl text-sm font-bold tracking-widest uppercase shadow-sm transition-transform active:scale-[0.98]" disabled={registerMutation.isPending}>
                {registerMutation.isPending ? <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : (
                  <>
                    SUBMIT APPLICATION <UserPlus className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
          </Form>
        </div>

        <p className="text-center brand-meta text-xs">
          ALREADY HAVE AN ACCOUNT?{' '}
          <Link href="/login" className="text-foreground font-bold hover:underline border-b border-foreground/30 pb-0.5">
            SIGN IN
          </Link>
        </p>
      </div>
    </div>
  );
}
