import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { TrendingUp, Award, Target, Flame, Sparkles } from "lucide-react";
import { WeeklyChart } from "@/components/WeeklyChart";
import { PortionChart } from "@/components/PortionChart";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { FullPageLoading, StatsCardSkeleton, ChartSkeleton, CardSkeleton } from "@/components/LoadingStates";
import { getDateRanges } from "@/lib/dateUtils";

type MealData = {
  id: string;
  user_id: string;
  food_name: string;
  portion_size: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  confidence?: number;
  is_proper_portion: boolean;
  image_url?: string;
  created_at: string;
};

export default function Insights() {
  const [latestAnalysis, setLatestAnalysis] = useState<MealData | null>(null);
  const [meals, setMeals] = useState<MealData[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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

      // Load latest analysis from sessionStorage for the top card UX
      const stored = sessionStorage.getItem('latestFoodAnalysis');
      if (stored && isMounted) setLatestAnalysis(JSON.parse(stored));

      const { data, error } = await supabase
        .from('user_meals')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      
      if (!error && data && isMounted) {
        setMeals(data);
      }

      if (!isMounted) return;

      // Realtime updates for this user's meals (INSERT only for efficiency)
      // Use unique channel name to prevent duplicates
      const channelName = `user_meals_realtime_${session.user.id}_${Date.now()}`;
      channel = supabase
        .channel(channelName)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'user_meals',
          filter: `user_id=eq.${session.user.id}`
        }, (payload: { new?: MealData }) => {
          if (payload?.new && isMounted) {
            setMeals((prev) => [payload.new as MealData, ...prev]);
          }
        })
        .subscribe(async (status) => {
          if (import.meta.env.DEV) {
            const { logInfo } = await import('@/lib/errorLogger');
            logInfo(`Realtime subscription status: ${status}`, {
              source: 'Insights',
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
  }, [navigate]);

  // Use centralized date utilities
  const monday = useMemo(() => {
    const ranges = getDateRanges();
    return new Date(ranges.week);
  }, []); // Recalculated on every load is fine for this use case

  const weeklyMeals = useMemo(() => meals.filter(m => new Date(m.created_at) >= monday), [meals, monday]);

  const avgWeeklyHealth = useMemo(() => {
    if (!weeklyMeals.length) return 0;
    const total = weeklyMeals.reduce((a, b) => a + (b.health_score || 0), 0);
    return total / weeklyMeals.length;
  }, [weeklyMeals]);

  const avgCaloriesPerDay = useMemo(() => {
    if (!meals.length) return 0;
    const byDay: Record<string, number> = {};
    meals.forEach(m => {
      const d = (m.meal_date || m.created_at.slice(0,10));
      byDay[d] = (byDay[d] || 0) + (m.calories || 0);
    });
    const values = Object.values(byDay);
    return values.reduce((a, b) => a + b, 0) / values.length;
  }, [meals]);

  const todayCalories = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0,10);
    return meals.filter(m => (m.meal_date || m.created_at.slice(0,10)) === todayStr)
      .reduce((a, b) => a + (b.calories || 0), 0);
  }, [meals]);

  const targetPct = useMemo(() => {
    const target = 2000; // daily target
    return target ? Math.min(100, (todayCalories / target) * 100) : 0;
  }, [todayCalories]);

  const streakDays = useMemo(() => {
    if (!meals.length) return 0;
    const dates = new Set(meals.map(m => (m.meal_date || m.created_at.slice(0,10))));
    let streak = 0;
    const d = new Date();
    d.setHours(0,0,0,0);
    while (true) {
      const key = d.toISOString().slice(0,10);
      if (dates.has(key)) {
        streak += 1;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }, [meals]);

  const weeklyTrend = useMemo(() => {
    const days = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
    const map: { sum: number; count: number }[] = days.map(() => ({ sum: 0, count: 0 }));
    weeklyMeals.forEach(m => {
      const d = new Date(m.created_at);
      const idx = (d.getDay() + 6) % 7; // make Monday=0
      map[idx].sum += m.health_score || 0;
      map[idx].count += 1;
    });
    return days.map((day, i) => ({ day, score: map[i].count ? map[i].sum / map[i].count : 0 }));
  }, [weeklyMeals]);

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Statistik & Insight</h1>
          <p className="text-muted-foreground">Pantau progres kesehatanmu</p>
        </div>

        {/* Latest AI Analysis Result */}
        {latestAnalysis && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="gradient-card p-6 border-primary/50 space-y-4">
              <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-primary" />
                <h3 className="font-bold text-xl">Analisis AI Terbaru</h3>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-secondary/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Makanan</p>
                  <p className="font-semibold">{latestAnalysis.food_name}</p>
                </div>
                <div className="text-center p-3 bg-secondary/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Kalori</p>
                  <p className="font-semibold text-chart-3">{latestAnalysis.calories} kkal</p>
                </div>
                <div className="text-center p-3 bg-secondary/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Protein</p>
                  <p className="font-semibold text-chart-1">{latestAnalysis.protein}g</p>
                </div>
                <div className="text-center p-3 bg-secondary/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Karbo</p>
                  <p className="font-semibold text-chart-2">{latestAnalysis.carbs}g</p>
                </div>
                <div className="text-center p-3 bg-secondary/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Lemak</p>
                  <p className="font-semibold text-chart-4">{latestAnalysis.fat}g</p>
                </div>
                <div className="text-center p-3 bg-secondary/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Serat</p>
                  <p className="font-semibold text-chart-5">{latestAnalysis.fiber}g</p>
                </div>
              </div>

              <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-sm font-medium text-primary mb-1">💡 Saran AI:</p>
                <p className="text-sm">{latestAnalysis.suggestion}</p>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Dianalisis dengan OpenAI Vision (GPT-4o-mini) • {new Date(latestAnalysis.timestamp).toLocaleString('id-ID')}
              </p>
            </Card>
          </motion.div>
        )}

        {/* Portion Breakdown Chart */}
        {latestAnalysis?.portion_breakdown && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <PortionChart 
              data={latestAnalysis.portion_breakdown}
              confidenceScore={latestAnalysis.confidence_score}
            />
          </motion.div>
        )}

        {/* Motivation Card */}
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="gradient-card p-6 border-primary/30">
            <div className="flex items-center gap-4">
              <div className="text-5xl">🌱</div>
              <div className="flex-1">
                <h3 className="font-bold text-xl mb-1">Keren! Keep Going! 🎉</h3>
                <p className="text-muted-foreground">
                  Rata-rata Health Score mingguan: <span className="text-success font-semibold">{avgWeeklyHealth.toFixed(1)}</span>
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Stats Grid */}
        {loading ? (
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <StatsCardSkeleton key={i} />
            ))}
          </div>
        ) : (
        <div className="grid grid-cols-2 gap-4">
          <Card className="gradient-card p-5 space-y-2">
            <div className="flex items-center gap-2 text-chart-1">
              <TrendingUp className="w-5 h-5" />
              <p className="text-sm font-medium">Avg Health Score</p>
            </div>
              <p className="text-3xl font-bold">{avgWeeklyHealth.toFixed(1)}</p>
            <p className="text-xs text-success flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
                Data realtime
            </p>
          </Card>

          <Card className="gradient-card p-5 space-y-2">
            <div className="flex items-center gap-2 text-chart-3">
              <Flame className="w-5 h-5" />
              <p className="text-sm font-medium">Avg Kalori</p>
            </div>
              <p className="text-3xl font-bold">{Math.round(avgCaloriesPerDay)}</p>
            <p className="text-xs text-muted-foreground">kkal/hari</p>
          </Card>

          <Card className="gradient-card p-5 space-y-2">
            <div className="flex items-center gap-2 text-chart-2">
              <Award className="w-5 h-5" />
              <p className="text-sm font-medium">Streak</p>
            </div>
              <p className="text-3xl font-bold">{streakDays}</p>
            <p className="text-xs text-muted-foreground">hari berturut-turut</p>
          </Card>

          <Card className="gradient-card p-5 space-y-2">
            <div className="flex items-center gap-2 text-chart-4">
              <Target className="w-5 h-5" />
              <p className="text-sm font-medium">Target</p>
            </div>
              <p className="text-3xl font-bold">{Math.round(targetPct)}%</p>
            <p className="text-xs text-muted-foreground">tercapai</p>
          </Card>
        </div>
        )}

        {/* Weekly Chart */}
        {loading ? (
          <ChartSkeleton height="250px" />
        ) : (
          <WeeklyChart data={weeklyTrend} />
        )}

        {/* Empty state */}
        {!loading && meals.length === 0 && (
          <Card className="gradient-card p-6 border-dashed border-primary/30 text-center">
            <p className="text-sm">Belum ada data analisis. Upload foto makananmu untuk melihat progres kesehatanmu!</p>
        </Card>
        )}
      </motion.div>
    </div>
  );
}
