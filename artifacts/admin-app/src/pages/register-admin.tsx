import React, { useEffect, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useVerifyAdminInvitation, useRegisterAdmin, getVerifyAdminInvitationQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function RegisterAdmin() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get('token');
  
  const { data: verification, isLoading: isVerifying, error: verificationError } = useVerifyAdminInvitation({ token: token || '' }, { query: { queryKey: getVerifyAdminInvitationQueryKey({ token: token || '' }), enabled: !!token, retry: false } });
  const { mutateAsync: registerAdmin, isPending: isRegistering } = useRegisterAdmin();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>No invitation token provided.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (verificationError || !verification?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Invalid Invitation</AlertTitle>
          <AlertDescription>This invitation link is invalid or has already been used.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      await registerAdmin({ data: { token, ...data } });
      toast({
        title: "Registration successful",
        description: "You can now log in with your credentials.",
      });
      setLocation('/auth');
    } catch (e: any) {
      toast({
        title: "Registration failed",
        description: e.response?.data?.error || "An error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Admin Registration</CardTitle>
          <CardDescription>
            Create your administrator account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="admin@example.com" {...field} />
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
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isRegistering}>
                {isRegistering && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Complete Registration
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
