import { useState, useEffect } from "react";
import { Camera, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import heroFood from "@/assets/hero-food.jpg";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { ImageUploader } from "@/components/ImageUploader";
import { compressImage } from "@/lib/imageCompression";

export default function Home() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check current session and redirect if not logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/landing", { replace: true });
        return;
      }
      setUser(session?.user ?? null);
    });

    // Listen for auth changes (termasuk OAuth callback)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/landing", { replace: true });
        return;
      }
      // Set user state setelah OAuth atau email login
      setUser(session?.user ?? null);
      
      // Jika ini OAuth callback, pastikan kita di /home
      if (event === "SIGNED_IN" && window.location.pathname !== "/home") {
        navigate("/home", { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleImageSelect = async (file: File) => {
    setIsAnalyzing(true);
    
    // Compress image before storing
    let processedFile = file;
    try {
      const compressionResult = await compressImage(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        quality: 0.8,
      });
      processedFile = compressionResult.file;
    } catch (compressionError) {
      // If compression fails, use original file
      const { logWarning } = await import('@/lib/errorLogger');
      logWarning('Image compression failed, using original file', {
        source: 'Home',
        additionalContext: { error: compressionError },
      });
      processedFile = file;
    }
    
    // Store image in sessionStorage for processing
    const reader = new FileReader();
    reader.onloadend = () => {
      sessionStorage.setItem('foodImage', reader.result as string);
      sessionStorage.setItem('foodImageName', processedFile.name);
      
      setTimeout(() => {
        setIsAnalyzing(false);
        navigate("/result");
      }, 1000);
    };
    reader.readAsDataURL(processedFile);
  };

  const handleCameraUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageSelect(file);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] relative bg-background">
      {/* Background image - Food App Style */}
      <div className="absolute inset-0 opacity-[0.12] bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{ backgroundImage: `url(${heroFood})` }}
      />
      
      <div className="container mx-auto px-4 md:px-6 py-12 md:py-16 relative z-10">
        {/* Login Buttons - Top Right */}
        {!user && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            className="flex justify-end gap-3 mb-12"
          >
            <Button
              variant="outline"
              onClick={() => navigate("/login")}
              aria-label="Login ke akun PortionPal"
              className="font-semibold"
            >
              Login
            </Button>
            <Button
              onClick={() => navigate("/register")}
              className="gap-2 font-semibold group"
              aria-label="Daftar akun baru PortionPal"
            >
              Sign Up
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
            </Button>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
          className="max-w-4xl mx-auto text-center space-y-8"
        >
          {/* Hero Title - Cal AI Style */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="space-y-6"
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight tracking-tight">
              Track your calories
              <br />
              <span className="text-3xl md:text-4xl lg:text-5xl font-semibold">with just a picture</span>
            </h1>
            <p className="text-base md:text-lg text-muted-foreground font-normal leading-relaxed max-w-2xl mx-auto mt-4" role="doc-subtitle">
              Analisis nutrisi makanan dengan AI hanya dalam hitungan detik
            </p>
          </motion.div>

          {/* Upload Card - Premium Cal AI Style */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4, ease: [0.4, 0, 0.2, 1] }}
          >
            <Card className="p-6 md:p-8 space-y-6 shadow-elegant">
              {isAnalyzing ? (
                <div className="py-12 space-y-4">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles className="w-16 h-16 mx-auto text-primary" />
                  </motion.div>
                  <p className="text-lg font-medium text-gradient" role="status" aria-live="polite">
                    AI sedang menganalisis makananmu...
                  </p>
                  <div className="w-48 h-2 mx-auto bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-primary to-accent"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 2 }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <label htmlFor="camera-upload" className="block mb-6">
                    <Button
                      size="lg"
                      className="w-full h-16 text-lg gap-3 font-bold group"
                      asChild
                    >
                      <span>
                        <Camera className="w-6 h-6 transition-transform duration-300 group-hover:scale-110" />
                        Ambil Foto Makanan
                      </span>
                    </Button>
                    <input
                      id="camera-upload"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleCameraUpload}
                      className="hidden"
                    />
                  </label>

                  <div className="relative mb-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">atau</span>
                    </div>
                  </div>

                  <ImageUploader onImageSelect={handleImageSelect} />

                  <div className="pt-4 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      💡 Tips: Foto dari atas dengan pencahayaan baik untuk hasil terbaik
                    </p>
                  </div>
                </>
              )}
            </Card>
          </motion.div>

          {/* Features - Cal AI Style */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6, ease: [0.4, 0, 0.2, 1] }}
            className="grid grid-cols-3 gap-6 pt-16"
          >
            {[
              { icon: "🎯", label: "Akurasi Tinggi", desc: "AI Precision" },
              { icon: "⚡", label: "Hasil Instan", desc: "Real-time" },
              { icon: "🌱", label: "Saran Personal", desc: "Tailored" },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.7 + i * 0.1 }}
                whileHover={{ scale: 1.05, y: -4 }}
                className="text-center p-6 rounded-2xl bg-white border border-border/10 shadow-soft hover:shadow-elegant transition-all duration-200 group cursor-default"
              >
                <div className="text-4xl mb-3 transition-transform duration-300 group-hover:scale-110">{feature.icon}</div>
                <p className="text-base font-bold mb-1">{feature.label}</p>
                <p className="text-xs text-muted-foreground font-medium">{feature.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
