import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * Component untuk menangani OAuth callback setelah Google login
 * Redirect user ke /home setelah OAuth berhasil
 */
export function OAuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Check session setelah OAuth redirect
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('OAuth callback error:', error);
          navigate("/landing", { replace: true });
          return;
        }

        if (session) {
          // User berhasil login via OAuth, redirect ke home
          navigate("/home", { replace: true });
        } else {
          // Tidak ada session, redirect ke landing
          navigate("/landing", { replace: true });
        }
      } catch (error) {
        console.error('OAuth callback handler error:', error);
        navigate("/landing", { replace: true });
      }
    };

    // Handle OAuth callback
    handleOAuthCallback();

    // Juga listen untuk auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        navigate("/home", { replace: true });
      } else if (!session && event === "SIGNED_OUT") {
        navigate("/landing", { replace: true });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground">Memproses autentikasi...</p>
      </div>
    </div>
  );
}


