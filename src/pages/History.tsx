import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { Calendar, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { FullPageLoading, MealCardSkeleton, ListSkeleton } from "@/components/LoadingStates";
import { getDateRangeForPeriod } from "@/lib/dateUtils";

type Meal = {
  id: string;
  created_at: string;
  image_url: string | null;
  calories: number | null;
  health_score: number | null;
};

const ITEMS_PER_PAGE = 10;

export default function History() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'month'>('today');
  const navigate = useNavigate();

  // Use centralized date utilities
  const dateRanges = useMemo(() => {
    return {
      today: getDateRangeForPeriod('today'),
      week: getDateRangeForPeriod('week'),
      month: getDateRangeForPeriod('month'),
    };
  }, []);

  // Load meals with pagination
  useEffect(() => {
    let isMounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (isMounted) {
          navigate("/landing", { replace: true });
        }
        return;
      }

      if (!isMounted) return;
      setLoading(true);

      // Build query based on active tab
      let query = supabase
        .from('user_meals')
        .select('id, created_at, image_url, calories, health_score', { count: 'exact' })
        .eq('user_id', session.user.id);

      // Apply date filter based on active tab
      if (activeTab === 'today') {
        query = query.gte('created_at', dateRanges.today);
      } else if (activeTab === 'week') {
        query = query.gte('created_at', dateRanges.week);
      } else if (activeTab === 'month') {
        query = query.gte('created_at', dateRanges.month);
      }

      // Apply pagination
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.order('created_at', { ascending: false }).range(from, to);

      const { data, error, count } = await query;

      if (!error && data && isMounted) {
        setMeals(data as Meal[]);
        setTotalCount(count || 0);
      }

      if (!isMounted) return;

      // Realtime subscription (only for INSERT events to avoid unnecessary refetches)
      // Use unique channel name to prevent duplicates
      const channelName = `user_meals_history_${session.user.id}_${activeTab}_${Date.now()}`;
      channel = supabase
        .channel(channelName)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'user_meals',
          filter: `user_id=eq.${session.user.id}`
        }, async () => {
          if (!isMounted) return;
          
          // Reload current page when new data is inserted
          const reloadQuery = supabase
            .from('user_meals')
            .select('id, created_at, image_url, calories, health_score', { count: 'exact' })
            .eq('user_id', session.user.id);

          if (activeTab === 'today') {
            reloadQuery.gte('created_at', dateRanges.today);
          } else if (activeTab === 'week') {
            reloadQuery.gte('created_at', dateRanges.week);
          } else if (activeTab === 'month') {
            reloadQuery.gte('created_at', dateRanges.month);
          }

          const { data: reloadData, count: reloadCount } = await reloadQuery
            .order('created_at', { ascending: false })
            .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1);

          if (reloadData && isMounted) {
            setMeals(reloadData as Meal[]);
            setTotalCount(reloadCount || 0);
          }
        })
        .subscribe(async (status) => {
          if (import.meta.env.DEV) {
            const { logInfo } = await import('@/lib/errorLogger');
            logInfo(`Realtime subscription status: ${status}`, {
              source: 'History',
              additionalContext: { status },
            });
          }
        });

      if (isMounted) {
        setLoading(false);
      }
    };

    load();

    // Cleanup function
    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [navigate, currentPage, activeTab, dateRanges]);

  // Calculate pagination
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const todayStr = new Date().toISOString().slice(0,10);
  const todayMeals = useMemo(() => {
    if (activeTab === 'today') {
      return meals.filter(m => m.created_at.slice(0,10) === todayStr);
    }
    return meals;
  }, [meals, todayStr, activeTab]);

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('ellipsis');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('ellipsis');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('ellipsis');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('ellipsis');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Riwayat Analisis</h1>
          <p className="text-muted-foreground">Track perjalanan nutrisimu</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => {
          setActiveTab(v as 'today' | 'week' | 'month');
          setCurrentPage(1); // Reset to first page when changing tabs
        }} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="today">Hari Ini</TabsTrigger>
            <TabsTrigger value="week">Minggu Ini</TabsTrigger>
            <TabsTrigger value="month">Bulan Ini</TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="space-y-4 mt-6">
            {loading ? (
              <ListSkeleton count={3} itemHeight="100px" />
            ) : todayMeals.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Kamu belum mengupload foto makanan apa pun.</p>
            ) : (
              todayMeals.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="gradient-card overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                  <div className="flex gap-4 p-4">
                    {item.image_url && (
                    <img
                        src={item.image_url}
                      alt="Food"
                      className="w-24 h-24 object-cover rounded-lg"
                        loading="lazy"
                    />
                    )}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-lg">{Math.round(item.calories || 0)} kkal</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <Badge
                          variant={(item.health_score || 0) >= 8 ? "default" : (item.health_score || 0) >= 7 ? "secondary" : "outline"}
                          className="gap-1"
                        >
                          <TrendingUp className="w-3 h-3" />
                          {(item.health_score || 0).toFixed(1)}/10
                        </Badge>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-primary to-shadow h-2 rounded-full"
                          style={{ width: `${(item.health_score || 0) * 10}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
              ))
            )}
          </TabsContent>

          <TabsContent value="week" className="space-y-4 mt-6">
            {loading ? (
              <ListSkeleton count={5} itemHeight="100px" />
            ) : meals.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Kamu belum mengupload foto makanan apa pun.</p>
            ) : (
              meals.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="gradient-card overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                  <div className="flex gap-4 p-4">
                    {item.image_url && (
                    <img
                        src={item.image_url}
                      alt="Food"
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                    )}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-lg">{Math.round(item.calories || 0)} kkal</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(item.created_at).toLocaleDateString('id-ID')} • {new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <Badge
                          variant={(item.health_score || 0) >= 8 ? "default" : (item.health_score || 0) >= 7 ? "secondary" : "outline"}
                          className="gap-1"
                        >
                          <TrendingUp className="w-3 h-3" />
                          {(item.health_score || 0).toFixed(1)}/10
                        </Badge>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-primary to-shadow h-2 rounded-full"
                          style={{ width: `${(item.health_score || 0) * 10}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
              ))
            )}
            
            {/* Pagination for week and month tabs */}
            {!loading && totalPages > 1 && (
              <div className="mt-6">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    
                    {getPageNumbers().map((page, idx) => (
                      <PaginationItem key={idx}>
                        {page === 'ellipsis' ? (
                          <PaginationEllipsis />
                        ) : (
                          <PaginationLink
                            onClick={() => setCurrentPage(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        )}
                      </PaginationItem>
                    ))}
                    
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
                
                <p className="text-center text-sm text-muted-foreground mt-4">
                  Menampilkan {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} dari {totalCount} hasil
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="month" className="space-y-4 mt-6">
            {loading ? (
              <ListSkeleton count={5} itemHeight="100px" />
            ) : meals.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Belum ada data bulan ini</p>
            ) : (
              meals.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="gradient-card overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                  <div className="flex gap-4 p-4">
                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt="Food"
                        className="w-24 h-24 object-cover rounded-lg"
                        loading="lazy"
                      />
                    )}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-lg">{Math.round(item.calories || 0)} kkal</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(item.created_at).toLocaleDateString('id-ID')} • {new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <Badge
                          variant={(item.health_score || 0) >= 8 ? "default" : (item.health_score || 0) >= 7 ? "secondary" : "outline"}
                          className="gap-1"
                        >
                          <TrendingUp className="w-3 h-3" />
                          {(item.health_score || 0).toFixed(1)}/10
                        </Badge>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-primary to-shadow h-2 rounded-full"
                          style={{ width: `${(item.health_score || 0) * 10}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
              ))
            )}
            
            {/* Pagination for month tab */}
            {!loading && totalPages > 1 && (
              <div className="mt-6">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    
                    {getPageNumbers().map((page, idx) => (
                      <PaginationItem key={idx}>
                        {page === 'ellipsis' ? (
                          <PaginationEllipsis />
                        ) : (
                          <PaginationLink
                            onClick={() => setCurrentPage(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        )}
                      </PaginationItem>
                    ))}
                    
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
                
                <p className="text-center text-sm text-muted-foreground mt-4">
                  Menampilkan {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} dari {totalCount} hasil
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
