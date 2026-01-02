import { motion } from "framer-motion";
import { ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
  emoji: string;
}

export const AuthLayout = ({ children, title, subtitle, emoji }: AuthLayoutProps) => {
  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center bg-background">
      <div className="absolute inset-0 bg-background" />
      
      <div className="container mx-auto px-6 py-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
          className="max-w-md mx-auto"
        >
          <Card className="p-10 md:p-12 space-y-8 shadow-elegant">
            <div className="text-center space-y-4">
              <motion.div
                initial={{ scale: 0.8, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", duration: 0.6, delay: 0.1 }}
                className="text-6xl mb-6"
              >
                {emoji}
              </motion.div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight">
                {title}
              </h1>
              <p className="text-lg text-muted-foreground font-light">
                {subtitle}
              </p>
            </div>
            
            {children}

            <div className="text-center text-sm text-muted-foreground pt-6 space-y-2 border-t border-border/10">
              <p className="font-medium">🔒 Data kamu aman dan terenkripsi</p>
              <p className="font-medium">✨ Gratis selamanya</p>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};
