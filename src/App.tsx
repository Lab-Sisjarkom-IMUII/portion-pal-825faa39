import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Layout } from "./components/Layout";
import { OAuthCallback } from "./components/OAuthCallback";
import Home from "./pages/Home";
import Landing from "./pages/Landing";
import Result from "./pages/Result";
import History from "./pages/History";
import Insights from "./pages/Insights";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Goal from "./pages/Goal";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/landing" element={<Landing />} />
            <Route path="/" element={<Landing />} />
            <Route path="/auth/callback" element={<OAuthCallback />} />
            <Route element={<Layout />}>
              <Route path="/home" element={<Home />} />
              <Route path="/result" element={<Result />} />
              <Route path="/history" element={<History />} />
              <Route path="/insights" element={<Insights />} />
              <Route path="/goal" element={<Goal />} />
              <Route path="/profile" element={<Profile />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
