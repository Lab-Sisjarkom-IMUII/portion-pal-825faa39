import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    const logError = async () => {
      const { logError: logErrorFn } = await import('@/lib/errorLogger');
      await logErrorFn(new Error(`404 Error: User attempted to access non-existent route: ${location.pathname}`), {
        source: 'NotFound',
        severity: 'low',
        additionalContext: {
          pathname: location.pathname,
        },
      });
    };
    void logError();
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center relative overflow-hidden bg-background">
      <div className="absolute inset-0 gradient-hero" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-transparent to-background/80" />
      
      <div className="relative z-10 text-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="space-y-6"
        >
          <div className="text-8xl md:text-9xl font-extrabold text-gradient mb-4">404</div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">Oops! Page not found</h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
            Halaman yang Anda cari tidak ditemukan atau telah dipindahkan.
          </p>
          <a 
            href="/" 
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-elegant hover:shadow-premium hover:scale-[1.02] transition-all duration-300"
          >
            Return to Home
          </a>
        </motion.div>
      </div>
    </div>
  );
};

export default NotFound;
