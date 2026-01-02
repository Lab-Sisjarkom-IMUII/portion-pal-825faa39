import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { 
  Camera, 
  Sparkles, 
  ArrowRight, 
  Brain, 
  TrendingUp, 
  Target,
  BarChart3,
  CheckCircle2,
  Upload,
  Eye,
  Save,
  Bell
} from "lucide-react";
import heroFood from "@/assets/hero-food.jpg";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { supabase } from "@/integrations/supabase/client";

export default function Landing() {
  const navigate = useNavigate();

  // Check if user is already logged in, redirect to home
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // User sudah login, redirect ke home
        navigate("/home", { replace: true });
      }
    };

    checkAuth();

    // Listen for auth changes (termasuk setelah OAuth callback)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        // User berhasil login (email atau OAuth), redirect ke home
        navigate("/home", { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const features = [
    {
      icon: Camera,
      title: "Analisis AI dari Foto",
      description: "Upload foto makanan dan biarkan AI yang menganalisis nutrisinya secara otomatis. Cepat, akurat, dan mudah."
    },
    {
      icon: Brain,
      title: "Health Score Pintar",
      description: "Dapatkan skor kesehatan otomatis berdasarkan komposisi nutrisi makananmu dengan teknologi AI."
    },
    {
      icon: BarChart3,
      title: "Tracking Nutrisi Lengkap",
      description: "Pantau kalori, protein, karbohidrat, lemak, dan serat dengan visualisasi yang mudah dipahami."
    },
    {
      icon: TrendingUp,
      title: "Insights & History",
      description: "Lihat statistik dan tren nutrisi harianmu untuk membantu mencapai tujuan kesehatan."
    }
  ];

  const steps = [
    {
      number: "01",
      icon: Upload,
      title: "Upload Foto",
      description: "Ambil foto makanan atau upload dari galeri"
    },
    {
      number: "02",
      icon: Eye,
      title: "Analisis AI",
      description: "AI menganalisis nutrisi secara otomatis"
    },
    {
      number: "03",
      icon: CheckCircle2,
      title: "Review Hasil",
      description: "Lihat kalori, makronutrien, dan health score"
    },
    {
      number: "04",
      icon: Save,
      title: "Simpan & Track",
      description: "Simpan ke history dan pantau progresmu"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <PWAInstallPrompt />
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm border-b border-border/20 shadow-sm">
        <div className="container mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
          <a 
            href="/" 
            className="flex items-center gap-3 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:rounded-xl focus:p-2 transition-all"
            aria-label="PortionPal - Home"
          >
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center overflow-hidden relative transition-transform duration-300 group-hover:scale-110">
              <img 
                src="/pwa-192x192.png" 
                alt="PortionPal Logo" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback ke icon Eye jika gambar tidak load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent && !parent.querySelector('.fallback-icon')) {
                    const fallback = document.createElement('div');
                    fallback.className = 'fallback-icon w-full h-full flex items-center justify-center';
                    fallback.innerHTML = '<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>';
                    parent.appendChild(fallback);
                  }
                }}
              />
            </div>
            <span className="text-xl font-bold text-foreground tracking-tight">PortionPal</span>
          </a>
          
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Fitur
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Cara Kerja
            </a>
            <a href="#contact" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Kontak
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => navigate("/login")}
              className="font-semibold"
            >
              Login
            </Button>
            <Button
              onClick={() => navigate("/register")}
              className="gap-2 font-semibold group"
            >
              Daftar
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 md:px-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.08] bg-cover bg-center bg-no-repeat pointer-events-none"
          style={{ backgroundImage: `url(${heroFood})` }}
        />
        
        <div className="container mx-auto max-w-6xl relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="text-center space-y-6"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
            >
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
                <Sparkles className="w-4 h-4" />
                AI-Powered Nutrition Analysis
              </span>
            </motion.div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
              Ukur Porsi Sehat
              <br />
              <span className="text-primary">Lebih Mudah</span> dengan
              <br />
              Bantuan AI
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              PortionPal membantu Anda menganalisis nutrisi makanan dengan mudah menggunakan teknologi AI. 
              Upload foto, dapatkan insight kalori dan makronutrien, dan kelola kesehatan Anda dengan lebih efisien bersama portionPal.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button
                size="lg"
                onClick={() => navigate("/login")}
                className="gap-2 text-lg font-semibold group h-14 px-8"
              >
                Mulai Sekarang
                <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-lg font-semibold h-14 px-8"
              >
                Lihat Fitur
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 md:px-6 bg-secondary/30">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Fitur Unggulan
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Semua yang Anda butuhkan untuk mengelola nutrisi dengan lebih efisien
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ y: -8, transition: { duration: 0.2 } }}
                >
                  <Card className="p-6 h-full hover:shadow-lg transition-all duration-300 border-border/50">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-20 px-4 md:px-6">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Cara Kerja
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Hanya dalam 4 langkah sederhana, nutrisi makananmu sudah teranalisis dengan baik
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="text-center"
                >
                  <div className="relative mb-6">
                    <div className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center text-xl font-bold mx-auto mb-4">
                      {step.number}
                    </div>
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                  <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-sm">
                    {step.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 md:px-6 bg-gradient-to-br from-primary/10 via-primary/5 to-background">
        <div className="container mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="space-y-6"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Mulai Analisis Nutrisi Anda
              <br />
              Lebih Mudah Dari Sekarang
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Bergabunglah dengan ribuan pengguna yang telah mempercayai PortionPal untuk mengelola nutrisi mereka
            </p>
            <Button
              size="lg"
              onClick={() => navigate("/login")}
              className="gap-2 text-lg font-semibold group h-14 px-8"
            >
              Coba PortionPal Gratis
              <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="py-12 px-4 md:px-6 bg-secondary/50 border-t border-border/50">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center overflow-hidden relative">
                  <img 
                    src="/pwa-192x192.png" 
                    alt="PortionPal Logo" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback ke icon Eye jika gambar tidak load
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent && !parent.querySelector('.fallback-icon')) {
                        const fallback = document.createElement('div');
                        fallback.className = 'fallback-icon w-full h-full flex items-center justify-center';
                        fallback.innerHTML = '<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>';
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                </div>
                <span className="text-xl font-bold">PortionPal</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Aplikasi AI-based untuk analisis nutrisi yang membantu Anda mengukur porsi makanan dengan lebih mudah dan lebih efisien.
              </p>
              <p className="text-xs text-muted-foreground mt-4">
                © 2025 PortionPal. All rights reserved.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#features" className="hover:text-foreground transition-colors">Fitur</a>
                </li>
                <li>
                  <a href="#how-it-works" className="hover:text-foreground transition-colors">Cara Kerja</a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">Pricing</a>
                </li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">Tentang</a>
                </li>
                <li>
                  <a href="#contact" className="hover:text-foreground transition-colors">Kontak</a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">Blog</a>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-border/50 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <div className="flex gap-6">
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="hover:text-foreground transition-colors">Security</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

