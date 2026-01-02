import { Home, History, TrendingUp, User, Target } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, label: "Home", path: "/home" },
  { icon: History, label: "Riwayat", path: "/history" },
  { icon: TrendingUp, label: "Statistik", path: "/insights" },
  { icon: Target, label: "Goal", path: "/goal" },
  { icon: User, label: "Profil", path: "/profile" },
];

export const BottomNav = () => {
  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border/20 md:hidden shadow-elegant"
      aria-label="Mobile navigation"
    >
      <div className="w-full">
        <div className="flex items-center justify-evenly h-20 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-1 flex-1 max-w-[20%] min-w-0 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                  isActive
                    ? "text-primary font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )
              }
              aria-label={`Navigate to ${item.label} page`}
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn("h-5 w-5 transition-transform duration-300 flex-shrink-0", isActive && "scale-110")} aria-hidden="true" />
                  <span className="text-xs font-semibold text-center leading-tight">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
};
