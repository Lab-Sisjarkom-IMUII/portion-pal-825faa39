import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Share2, Save, RotateCcw, Sparkles } from "lucide-react";
import { MacroChart } from "@/components/MacroChart";
import { HealthScore } from "@/components/HealthScore";
import { PortionChart } from "@/components/PortionChart";
import { FullPageLoading } from "@/components/LoadingStates";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { analyzeFoodImage, type FoodInsight } from "@/lib/aiAnalysis";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ErrorMessages } from "@/lib/errorMessages";
import type { Database } from "@/integrations/supabase/types";

export default function Result() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [foodImage, setFoodImage] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<FoodInsight | null>(null);

  // Load image and analyze on mount
  useEffect(() => {
    const run = async () => {
      const storedImage = sessionStorage.getItem('foodImage');
      const storedImageName = sessionStorage.getItem('foodImageName');

      // Ensure user is logged in before attempting analysis
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: ErrorMessages.auth.pleaseLogin,
          description: ErrorMessages.auth.pleaseLoginDescription,
          variant: 'destructive',
        });
        navigate('/login');
        return;
      }

      if (storedImage) {
        setFoodImage(storedImage);
        analyzeImage(storedImage, storedImageName || 'food.jpg');
      } else {
        toast({
          title: ErrorMessages.image.noImage,
          description: ErrorMessages.image.noImageDescription,
          variant: "destructive",
        });
        navigate('/home');
      }
    };

    void run();
    // analyzeImage and navigate are stable, toast is from hook
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calculate health score from macros
  const calculateHealthScore = (result: FoodInsight) => {
    const { protein, carbs, fat, fiber } = result;
    const total = protein + carbs + fat + fiber;
    if (total === 0) return 0;
    const proteinScore = Math.min((protein / total) * 100 / 30, 1) * 3;
    const carbsScore = Math.min((carbs / total) * 100 / 50, 1) * 3;
    const fatScore = Math.min((fat / total) * 100 / 25, 1) * 2;
    const fiberScore = Math.min(fiber / 5, 1) * 2;
    return Math.min((proteinScore + carbsScore + fatScore + fiberScore), 10);
  };

  const analyzeImage = async (imageData: string, imageName: string) => {
    setIsAnalyzing(true);
    try {
      // Convert base64 to File
      const response = await fetch(imageData);
      if (!response.ok) throw new Error(`Load image blob failed: ${response.status} ${response.statusText}`);
      const blob = await response.blob();
      const file = new File([blob], imageName, { type: 'image/jpeg' });
      
      const result = await analyzeFoodImage(file);
      if (import.meta.env.DEV) {
        const { logInfo } = await import('@/lib/errorLogger');
        logInfo("Hasil akhir analisis", {
          source: 'Result',
          additionalContext: {
            foodName: result.food_name,
            calories: result.calories,
          },
        });
      }
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid AI response: empty');
      }
      if (result.calories === undefined || result.protein === undefined) {
        const { logWarning } = await import('@/lib/errorLogger');
        logWarning('AI response missing expected fields, using safe defaults', {
          source: 'Result',
          additionalContext: { result },
        });
      }
      setAnalysisResult(result);
      
      // Store result for Insights page
      sessionStorage.setItem('latestFoodAnalysis', JSON.stringify(result));

      // Persist to Supabase user_meals
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const healthScore = calculateHealthScore(result);
        type PortionBreakdown = { vegetables_percentage?: number };
        const breakdown = result.portion_breakdown as PortionBreakdown | undefined;
        const vegetables = breakdown?.vegetables_percentage ?? null;
        // Explicitly define payload to avoid including 'fat' column which doesn't exist in schema
        // Use type-safe approach with Database types
        type UserMealInsert = Database['public']['Tables']['user_meals']['Insert'];
        const mealPayload: UserMealInsert = {
          user_id: user.id,
          food_name: result.food_name,
          calories: result.calories,
          health_score: Number(healthScore.toFixed(2)),
          protein: result.protein,
          carbs: result.carbs,
          vegetables: vegetables,
          fiber: result.fiber ?? 0,
          image_url: imageData,
          // Note: fat column does not exist in user_meals table schema
        };
        const { error: insertError } = await supabase.from('user_meals').insert(mealPayload);
        if (insertError) {
          const { logError } = await import('@/lib/errorLogger');
          await logError(new Error(insertError.message), {
            source: 'Result',
            severity: 'medium',
            additionalContext: {
              action: 'insert_user_meals',
              errorCode: insertError.code,
            },
          });
          toast({
            title: ErrorMessages.data.databaseError,
            description: insertError.message,
            variant: 'destructive',
          });
        }
      }
      
      toast({
        title: ErrorMessages.image.analysisSuccess,
        description: `Makanan terdeteksi: ${result.food_name}`,
      });
    } catch (error) {
      const { logError } = await import('@/lib/errorLogger');
      await logError(error instanceof Error ? error : new Error(String(error)), {
        source: 'Result',
        severity: 'high',
        additionalContext: {
          action: 'analyze_image',
        },
      });
      toast({
        title: ErrorMessages.image.analysisFailed,
        description: error instanceof Error ? error.message : ErrorMessages.image.analysisFailedDescription,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  

  if (!analysisResult) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        {isAnalyzing ? (
          <FullPageLoading message="Menganalisis gambar makanan..." />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center min-h-[60vh] space-y-6"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="w-16 h-16 text-primary" />
            </motion.div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Menganalisis Makanan...</h2>
              <p className="text-muted-foreground">AI sedang memeriksa nutrisi makananmu</p>
            </div>
            <div className="w-64 h-2 bg-secondary rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-accent"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 3, repeat: Infinity }}
              />
            </div>
            <Button onClick={() => analyzeImage(foodImage, 'food.jpg')} disabled={isAnalyzing}>
              {isAnalyzing ? "Menganalisis..." : "Mulai Analisis"}
            </Button>
          </motion.div>
        )}
      </div>
    );
  }

  const healthScore = analysisResult.health_score ?? calculateHealthScore(analysisResult);

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Hasil Analisis</h1>
          <p className="text-muted-foreground">AI telah menganalisis makananmu</p>
        </div>

        {/* Image Result */}
        <Card className="gradient-card overflow-hidden">
          <img
            src={foodImage}
            alt="Analyzed food"
            className="w-full h-64 object-cover"
          />
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-center">
              <Badge variant="default" className="text-sm">
                {analysisResult.food_name}
              </Badge>
            </div>
          </div>
        </Card>

        {/* Calories & Health Score */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="gradient-card p-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">Total Kalori</p>
            <p className="text-4xl font-bold text-gradient">{analysisResult.calories}</p>
            <p className="text-xs text-muted-foreground">kkal</p>
          </Card>
          
          <HealthScore score={typeof healthScore === 'number' ? healthScore : 0} confidence={analysisResult.confidence_score} />
        </div>

        {/* Macronutrients */}
        <Card className="gradient-card p-6 space-y-4">
          <h2 className="text-xl font-semibold">Makronutrien</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Protein</p>
              <p className="text-2xl font-bold text-chart-1">{analysisResult.protein}g</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Karbohidrat</p>
              <p className="text-2xl font-bold text-chart-3">{analysisResult.carbs}g</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Lemak</p>
              <p className="text-2xl font-bold text-chart-4">{analysisResult.fat}g</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Serat</p>
              <p className="text-2xl font-bold text-chart-2">{analysisResult.fiber}g</p>
            </div>
          </div>
        </Card>

        {/* Macronutrient Chart */}
        <MacroChart data={{
          protein: analysisResult.protein,
          carbs: analysisResult.carbs,
          fat: analysisResult.fat,
          fiber: analysisResult.fiber,
        }} />

        {/* Portion Breakdown Chart */}
        {analysisResult.portion_breakdown && (
          <PortionChart 
            data={analysisResult.portion_breakdown}
            confidenceScore={analysisResult.confidence_score}
          />
        )}

        {/* AI Suggestion */}
        <Card className="gradient-card p-6 space-y-4 border-primary/20">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="font-semibold text-lg">Saran AI untuk Kamu</h3>
              <p className="text-muted-foreground">{analysisResult.suggestion}</p>
              <Badge variant="outline" className="text-xs mt-2">
                {analysisResult.aiMode === 'openai-vision' ? '✨ Dianalisis dengan OpenAI Vision (GPT-4o-mini)' : '🤖 AI Analysis'}
              </Badge>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-3">
          <Button variant="outline" className="gap-2">
            <Share2 className="w-4 h-4" />
            Bagikan
          </Button>
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={() => {
              toast({
                title: ErrorMessages.success.saved,
                description: ErrorMessages.success.savedDescription,
              });
            }}
          >
            <Save className="w-4 h-4" />
            Simpan
          </Button>
          <Button
            variant="default"
            className="gap-2"
            onClick={() => navigate("/home")}
          >
            <RotateCcw className="w-4 h-4" />
            Analisis Lagi
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
