import { Outlet, NavLink } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { Home, BarChart3, Clock, UserCircle, Target } from "lucide-react";
import { cn } from "@/lib/utils";

export const Layout = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background pb-20 md:pb-0">
      {/* Skip to main content link for screen readers */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        Skip to main content
      </a>
      
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-border/20 shadow-soft">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <a 
            href="/home" 
            className="flex items-center gap-3 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:rounded-xl focus:p-2 transition-all"
            aria-label="PortionPal - Home"
          >
            <span className="text-3xl transition-transform duration-300 group-hover:scale-110" aria-hidden="true">🍽️</span>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">PortionPal</h1>
          </a>
          
          {/* Desktop Navigation - Centered */}
          <nav className="hidden md:flex items-center gap-2 absolute left-1/2 transform -translate-x-1/2" aria-label="Main navigation">
            <NavLink
              to="/home"
              end
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-soft border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent"
                )
              }
              aria-label="Home page"
            >
              <Home className="w-4 h-4" aria-hidden="true" />
              <span>Home</span>
            </NavLink>
            
            <NavLink
              to="/insights"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-soft border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent"
                )
              }
              aria-label="Insights page"
            >
              <BarChart3 className="w-4 h-4" aria-hidden="true" />
              <span>Insights</span>
            </NavLink>
            
            <NavLink
              to="/history"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-soft border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent"
                )
              }
              aria-label="History page"
            >
              <Clock className="w-4 h-4" aria-hidden="true" />
              <span>History</span>
            </NavLink>
            
            <NavLink
              to="/goal"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-soft border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent"
                )
              }
              aria-label="Goal page"
            >
              <Target className="w-4 h-4" aria-hidden="true" />
              <span>Goal</span>
            </NavLink>
            
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-soft border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent"
                )
              }
              aria-label="Profile page"
            >
              <UserCircle className="w-4 h-4" aria-hidden="true" />
              <span>Profile</span>
            </NavLink>
          </nav>
          
        </div>
      </header>
      
      <main id="main-content" className="flex-1 mt-20 pb-16" role="main">
        <Outlet />
      </main>
      
      <footer className="fixed bottom-0 left-0 right-0 py-3 text-center text-xs text-muted-foreground border-t border-border/20 bg-white z-40 shadow-soft hidden md:block">
        <p>Powered by <span className="font-semibold text-foreground">PortionPal</span></p>
      </footer>
      
      <BottomNav />
    </div>
  );
};
