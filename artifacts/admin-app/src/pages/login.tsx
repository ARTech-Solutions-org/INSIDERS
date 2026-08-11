import { useState } from "react";
import { useLoginAdmin } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { setAuthToken } from "@/lib/auth";
import { Lock, Mail, Loader2 } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { mutate: login, isPending } = useLoginAdmin({
    mutation: {
      onSuccess: (data) => {
        if (data.token) {
          setAuthToken(data.token);
        }
        queryClient.invalidateQueries();
        setLocation("/");
      },
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: (err as any).response?.data?.error || "Invalid credentials",
        });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ data: { email, password } });
  };

  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* Left panel - Branding */}
      <div className="hidden lg:flex flex-1 flex-col justify-center items-center bg-primary text-primary-foreground p-12 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none" />
        
        <div className="max-w-md space-y-6 relative z-10">
           <div className="h-24 w-auto flex items-center justify-start">
             <img src="/insiders-logo.png" alt="Insiders Logo" className="h-full w-auto object-contain brightness-0 invert" />
          </div>
           <div className="brand-slashes text-2xl">//////</div>
           <h2 className="brand-meta text-primary-foreground/80">COMMAND THE ROOM. OWN THE FLOW.</h2>
          <p className="text-lg text-primary-foreground/60 leading-relaxed pt-4">
             The operations desk for people who keep the room moving.
          </p>
        </div>
      </div>

      {/* Right panel - Login form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 md:px-24">
        <div className="w-full max-w-sm mx-auto space-y-8">
          
          <div className="space-y-2 lg:hidden text-center mb-8">
             <div className="h-16 w-auto flex items-center justify-center mx-auto mb-4">
              <img src="/insiders-logo.png" alt="Insiders Logo" className="h-full w-auto object-contain brightness-0 invert" />
            </div>
             <h1 className="brand-display text-3xl">/ ADMIN</h1>
          </div>

          <div className="space-y-2">
             <h2 className="brand-display text-3xl tracking-tight text-foreground">BACK IN CONTROL</h2>
             <p className="brand-meta text-muted-foreground">ENTER YOUR ACCESS DETAILS</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                    <Mail className="w-4 h-4" />
                  </div>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="admin@artech.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                    <Lock className="w-4 h-4" />
                  </div>
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            </div>

             <Button type="submit" className="w-full rounded-none uppercase tracking-wider font-bold" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Authenticating...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
