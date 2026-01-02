import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, Chrome, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/AuthLayout";
import { loginSchema } from "@/lib/validators";
import { ErrorMessages } from "@/lib/errorMessages";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        // Redirect ke home setelah OAuth atau email login
        navigate("/home", { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validation = loginSchema.safeParse({ email, password });
      if (!validation.success) {
        toast({
          title: ErrorMessages.validation.invalidInput,
          description: validation.error.errors[0].message,
          variant: "destructive",
        });
        return;
      }

      setLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          // Don't log invalid credentials as errors (security best practice)
          toast({
            title: ErrorMessages.auth.loginFailed,
            description: ErrorMessages.auth.loginFailedDescription,
            variant: "destructive",
          });
        } else {
          const { logError } = await import('@/lib/errorLogger');
          await logError(error instanceof Error ? error : new Error(String(error)), {
            source: 'Login',
            severity: 'medium',
            additionalContext: {
              action: 'email_login',
            },
          });
          throw error;
        }
      } else {
        toast({
          title: ErrorMessages.auth.loginSuccess,
          description: ErrorMessages.auth.loginSuccessDescription,
        });
        // Redirect langsung setelah login berhasil dengan sedikit delay untuk memastikan state ter-update
        setTimeout(() => {
          navigate("/home", { replace: true });
        }, 100);
      }
    } catch (error: unknown) {
      const { logError } = await import('@/lib/errorLogger');
      await logError(error instanceof Error ? error : new Error(String(error)), {
        source: 'Login',
        severity: 'medium',
        additionalContext: {
          action: 'email_login',
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
          // Redirect ke /home setelah OAuth berhasil
          redirectTo: `${window.location.origin}/home`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        },
      });

      if (error) {
        const { logError } = await import('@/lib/errorLogger');
        await logError(error instanceof Error ? error : new Error(String(error)), {
          source: 'Login',
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
        source: 'Login',
        severity: 'medium',
        additionalContext: {
          action: 'google_auth',
        },
      });
      const message = error instanceof Error ? error.message : "Silakan coba lagi";
      toast({
        title: ErrorMessages.auth.googleAuthFailed,
        description: message || ErrorMessages.general.errorDescription,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome Back to PortionPal"
      subtitle="Log in to continue your healthy journey"
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
        aria-label="Login dengan Google"
        aria-busy={loading}
      >
        <Chrome className="w-5 h-5" aria-hidden="true" />
        Continue with Google
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">atau</span>
        </div>
      </div>

      <form onSubmit={handleEmailLogin} className="space-y-4">
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
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
            className="h-11"
            aria-label="Password"
            aria-required="true"
            autoComplete="current-password"
          />
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={loading}
          aria-label={loading ? "Sedang memproses login" : "Sign in ke akun"}
          aria-busy={loading}
        >
          {loading ? "Mohon tunggu..." : "Sign In"}
        </Button>
      </form>

      <div className="text-center text-sm">
        <Link
          to="/register"
          className="text-primary hover:underline font-medium"
        >
          Don't have an account? Sign up here
        </Link>
      </div>
    </AuthLayout>
  );
}
