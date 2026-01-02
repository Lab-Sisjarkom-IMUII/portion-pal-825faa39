import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, Chrome, ArrowLeft, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/AuthLayout";
import { registerSchema } from "@/lib/validators";
import { ErrorMessages } from "@/lib/errorMessages";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/home");
      }
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && event === "SIGNED_IN") {
        navigate("/home");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validation = registerSchema.safeParse({ name, email, password, confirmPassword });
      if (!validation.success) {
        toast({
          title: ErrorMessages.validation.invalidInput,
          description: validation.error.errors[0].message,
          variant: "destructive",
        });
        return;
      }

      setLoading(true);

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/home`,
          data: {
            full_name: name,
          },
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          // Don't log "already registered" as error (expected user behavior)
          toast({
            title: ErrorMessages.validation.emailAlreadyRegistered,
            description: ErrorMessages.validation.emailAlreadyRegisteredDescription,
            variant: "destructive",
          });
        } else {
          const { logError } = await import('@/lib/errorLogger');
          await logError(error instanceof Error ? error : new Error(String(error)), {
            source: 'Register',
            severity: 'medium',
            additionalContext: {
              action: 'email_register',
            },
          });
          throw error;
        }
      } else {
        toast({
          title: ErrorMessages.auth.registerSuccess,
          description: ErrorMessages.auth.registerSuccessDescription,
        });
        navigate("/login");
      }
    } catch (error: unknown) {
      const { logError } = await import('@/lib/errorLogger');
      await logError(error instanceof Error ? error : new Error(String(error)), {
        source: 'Register',
        severity: 'medium',
        additionalContext: {
          action: 'email_register',
        },
      });
      const message = error instanceof Error ? error.message : "Silakan coba lagi";
      toast({
        title: ErrorMessages.general.error,
        description: message || ErrorMessages.general.errorDescription,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        },
      });

      if (error) {
        const { logError } = await import('@/lib/errorLogger');
        await logError(error instanceof Error ? error : new Error(String(error)), {
          source: 'Register',
          severity: 'medium',
          additionalContext: {
            action: 'google_oauth',
          },
        });
        throw error;
      }
    } catch (error: unknown) {
      const { logError } = await import('@/lib/errorLogger');
      await logError(error instanceof Error ? error : new Error(String(error)), {
        source: 'Register',
        severity: 'medium',
        additionalContext: {
          action: 'google_signup',
        },
      });
      const message = error instanceof Error ? error.message : "Silakan coba lagi";
      toast({
        title: ErrorMessages.auth.googleSignupFailed,
        description: message || ErrorMessages.general.errorDescription,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Join PortionPal Today 🌿"
      subtitle="Start your journey to balanced nutrition"
      emoji="👁️🍽️"
    >
      <Button
        variant="ghost"
        className="mb-4 -mt-4"
        onClick={() => navigate("/landing")}
        aria-label="Kembali ke halaman utama"
      >
        <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
        Kembali
      </Button>

      <Button
        variant="outline"
        size="lg"
        className="w-full gap-3"
        onClick={handleGoogleAuth}
        disabled={loading}
        aria-label="Daftar dengan Google"
        aria-busy={loading}
      >
        <Chrome className="w-5 h-5" aria-hidden="true" />
        Sign up with Google
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">atau</span>
        </div>
      </div>

      <form onSubmit={handleEmailRegister} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="flex items-center gap-2">
            <User className="w-4 h-4" aria-hidden="true" />
            Full Name
          </Label>
          <Input
            id="name"
            type="text"
            placeholder="Nama lengkap"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            required
            className="h-11"
            aria-label="Nama lengkap"
            aria-required="true"
            autoComplete="name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="flex items-center gap-2">
            <Mail className="w-4 h-4" aria-hidden="true" />
            Email address
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="nama@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
            className="h-11"
            aria-label="Email address"
            aria-required="true"
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="flex items-center gap-2">
            <Lock className="w-4 h-4" aria-hidden="true" />
            Password
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="Minimal 6 karakter"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
            className="h-11"
            aria-label="Password"
            aria-required="true"
            autoComplete="new-password"
            aria-describedby="password-help"
          />
          <p id="password-help" className="sr-only">Password minimal 6 karakter, harus mengandung huruf besar, huruf kecil, dan angka</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="flex items-center gap-2">
            <Lock className="w-4 h-4" aria-hidden="true" />
            Confirm Password
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="Ulangi password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
            required
            className="h-11"
            aria-label="Konfirmasi password"
            aria-required="true"
            autoComplete="new-password"
            aria-describedby="confirm-password-help"
          />
          <p id="confirm-password-help" className="sr-only">Ulangi password yang sama dengan password di atas</p>
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={loading}
          aria-label={loading ? "Sedang memproses pendaftaran" : "Daftar akun baru"}
          aria-busy={loading}
        >
          {loading ? "Mohon tunggu..." : "Create Account"}
        </Button>
      </form>

      <div className="text-center text-sm">
        <Link
          to="/login"
          className="text-primary hover:underline font-medium"
        >
          Already have an account? Log in here
        </Link>
      </div>
    </AuthLayout>
  );
}
