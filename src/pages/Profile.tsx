import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, Mail, User as UserIcon, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ErrorMessages } from "@/lib/errorMessages";

type UserProfile = {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
};

export default function Profile() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/landing", { replace: true });
        return;
      }
      
      setUser(session.user);
      setDisplayName(session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "");
      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/landing", { replace: true });
      } else {
        setUser(session.user);
        setDisplayName(session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      toast({
        title: ErrorMessages.auth.logoutSuccess,
        description: ErrorMessages.auth.logoutSuccessDescription,
      });
      
      navigate("/landing");
    } catch (error: unknown) {
      const { logError } = await import('@/lib/errorLogger');
      await logError(error instanceof Error ? error : new Error(String(error)), {
        source: 'Profile',
        severity: 'medium',
        additionalContext: {
          action: 'logout',
        },
      });
      const message = error instanceof Error ? error.message : "Silakan coba lagi";
      toast({
        title: ErrorMessages.auth.logoutFailed,
        description: message || ErrorMessages.general.errorDescription,
        variant: "destructive",
      });
    }
  };

  const handleSaveName = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: ErrorMessages.general.error,
          description: ErrorMessages.auth.userNotFound,
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.auth.updateUser({
        data: { full_name: displayName },
      });

      if (error) {
        throw error;
      }

      setIsEditingName(false);
      toast({
        title: ErrorMessages.profile.saveNameSuccess,
        description: ErrorMessages.profile.saveNameSuccessDescription,
      });
    } catch (error: unknown) {
      const { logError } = await import('@/lib/errorLogger');
      await logError(error instanceof Error ? error : new Error(String(error)), {
        source: 'Profile',
        severity: 'medium',
        additionalContext: {
          action: 'save_name',
        },
      });
      toast({
        title: ErrorMessages.profile.saveNameFailed,
        description: error instanceof Error ? error.message : ErrorMessages.profile.saveNameFailedDescription,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Memuat profil...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
  const email = user.email;
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-2xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gradient">Profil Saya</h1>
          <p className="text-muted-foreground">Kelola akun & preferensi Anda</p>
        </div>

        {/* Profile Card */}
        <Card className="gradient-card p-8 space-y-6">
          <div className="flex flex-col items-center gap-6">
            {/* Avatar */}
            <div className="relative group">
              <Avatar className="w-32 h-32 border-4 border-primary/20">
                <AvatarImage src={avatarUrl} alt={displayName} />
                <AvatarFallback className="text-3xl bg-gradient-to-br from-primary to-accent text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <UserIcon className="w-8 h-8 text-white" />
              </div>
            </div>

            {/* Name Input */}
            <div className="w-full space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2">
                <UserIcon className="w-4 h-4" />
                Nama Lengkap
              </Label>
              <div className="flex gap-2">
                <Input
                  id="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={!isEditingName}
                  className="h-11"
                />
                {isEditingName ? (
                  <Button onClick={handleSaveName} variant="default">
                    Simpan
                  </Button>
                ) : (
                  <Button onClick={() => setIsEditingName(true)} variant="outline" size="icon">
                    <Edit className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Email Display */}
            <div className="w-full space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email
              </Label>
              <Input
                value={email}
                disabled
                className="h-11 bg-muted"
              />
            </div>
          </div>
        </Card>

        {/* Logout Button */}
        <Card className="gradient-card p-6">
          <Button
            onClick={handleLogout}
            variant="destructive"
            className="w-full gap-2"
            size="lg"
          >
            <LogOut className="w-5 h-5" />
            Keluar dari Akun
          </Button>
        </Card>

        {/* Footer */}
        <div className="text-center pt-6 pb-4">
          <p className="text-xs text-muted-foreground">
            🔒 Data Anda aman & terenkripsi
          </p>
        </div>
      </motion.div>
    </div>
  );
}
