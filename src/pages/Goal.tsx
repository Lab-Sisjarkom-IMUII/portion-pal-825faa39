import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Target, Loader2, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { goalFormSchema, parseNumberInput } from "@/lib/validators";
import type { GoalCalculatorResponse } from "@/types/api";
import type { Database } from "@/integrations/supabase/types";
import { FullPageLoading, FormSkeleton } from "@/components/LoadingStates";
import { ErrorMessages, formatErrorMessage } from "@/lib/errorMessages";
import { logError, logWarning, logInfo } from "@/lib/errorLogger";
import { getEnv } from "@/lib/env";

type UserGoalRow = Database['public']['Tables']['user_goals']['Row'];

interface GoalFormData {
  goal_type: 'lose_weight' | 'reduce_calories';
  age: number;
  gender: 'male' | 'female';
  height: number;
  weight: number;
  activity: 'sedentary' | 'moderate' | 'active';
  target_time: string;
  target_weight?: number;
}

interface AIResult {
  daily_calories: number;
  carbs_percent: number;
  protein_percent: number;
  fat_percent: number;
  carbs_grams: number;
  protein_grams: number;
  fat_grams: number;
  suggestion: string;
}

/**
 * Type guard to check if an object matches AIResult structure
 */
function isAIResult(obj: unknown): obj is AIResult {
  if (!obj || typeof obj !== 'object') return false;
  const result = obj as Record<string, unknown>;
  return (
    typeof result.daily_calories === 'number' &&
    typeof result.carbs_percent === 'number' &&
    typeof result.protein_percent === 'number' &&
    typeof result.fat_percent === 'number' &&
    typeof result.carbs_grams === 'number' &&
    typeof result.protein_grams === 'number' &&
    typeof result.fat_grams === 'number' &&
    typeof result.suggestion === 'string'
  );
}

export default function Goal() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loadingPrevious, setLoadingPrevious] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [previousGoal, setPreviousGoal] = useState<UserGoalRow | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<GoalFormData>({
    goal_type: 'lose_weight',
    age: 25,
    gender: 'male',
    height: 170,
    weight: 70,
    activity: 'moderate',
    target_time: '',
    target_weight: undefined,
  });

  useEffect(() => {
    loadPreviousGoal();
  }, []);

  const loadPreviousGoal = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      const { data, error } = await supabase
        .from('user_goals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        await logError(new Error(error.message), {
          source: 'Goal',
          severity: 'medium',
          additionalContext: {
            action: 'load_previous_goal',
            errorCode: error.code,
          },
        });
        toast.error(ErrorMessages.goal.loadFailed);
      }

      if (data) {
        setPreviousGoal(data);
        setFormData({
          goal_type: data.goal_type as 'lose_weight' | 'reduce_calories',
          age: data.age,
          gender: data.gender as 'male' | 'female',
          height: parseFloat(data.height.toString()),
          weight: parseFloat(data.weight.toString()),
          activity: data.activity as 'sedentary' | 'moderate' | 'active',
          target_time: data.target_time,
          target_weight: data.target_weight ? parseFloat(data.target_weight.toString()) : undefined,
        });
        // Safely parse ai_result with type guard
        if (data.ai_result && isAIResult(data.ai_result)) {
          setAiResult(data.ai_result);
        } else if (data.ai_result) {
          // Log warning if ai_result exists but doesn't match expected structure
          logWarning('AI result structure does not match expected format', {
            source: 'Goal',
            additionalContext: { ai_result: data.ai_result },
          });
        }
        setShowForm(true);
      }
    } catch (error) {
      await logError(error instanceof Error ? error : new Error(String(error)), {
        source: 'Goal',
        severity: 'medium',
        additionalContext: {
          action: 'load_previous_goal',
        },
      });
    } finally {
      setLoadingPrevious(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Comprehensive validation using Zod
    const validation = goalFormSchema.safeParse(formData);
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError.message || ErrorMessages.validation.invalidInput);
      return;
    }

    // Use validated data
    const validatedData = validation.data;

    setLoading(true);
    setAiResult(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error(ErrorMessages.auth.sessionInvalid);
        navigate('/login');
        return;
      }

      // Log what we're sending
      if (import.meta.env.DEV) {
        logInfo('Sending request to goal-calculator', {
          source: 'Goal',
          additionalContext: {
            hasAccessToken: !!session.access_token,
            validatedData: {
              goal_type: validatedData.goal_type,
              target_time: validatedData.target_time,
              target_weight: validatedData.target_weight,
              age: validatedData.age,
              weight: validatedData.weight,
            },
            fullValidatedData: validatedData,
          },
        });
        // Also log to console for easier debugging
        console.log('📤 Sending to goal-calculator:', JSON.stringify(validatedData, null, 2));
      }

      // Try SDK invoke first, fallback to direct fetch if needed
      let response: { data: unknown; error: unknown } | null = null;
      
      try {
        // Supabase functions.invoke expects body as an object, not a JSON string
        response = await supabase.functions.invoke('goal-calculator', {
          body: validatedData, // Send as object, not JSON string
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        
        // If SDK invoke fails or returns error, try direct fetch
        if (response.error || !response.data) {
          throw new Error('SDK invoke failed, trying direct fetch');
        }
      } catch (sdkError) {
        if (import.meta.env.DEV) {
          logWarning('SDK invoke failed, falling back to direct fetch', {
            source: 'Goal',
            additionalContext: { error: sdkError },
          });
        }
        
        // Fallback: Direct fetch to Edge Function
        const env = getEnv();
        const projectId = env.VITE_SUPABASE_PROJECT_ID;
        const functionUrl = projectId 
          ? `https://${projectId}.functions.supabase.co/functions/v1/goal-calculator`
          : `${env.VITE_SUPABASE_URL}/functions/v1/goal-calculator`;
        
        // Refresh session to ensure valid token
        await supabase.auth.refreshSession();
        const { data: { session: refreshedSession } } = await supabase.auth.getSession();
        
        if (!refreshedSession) {
          throw new Error('Session expired, please login again');
        }
        
        const fetchResponse = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${refreshedSession.access_token}`,
            'apikey': env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify(validatedData),
        });
        
        if (!fetchResponse.ok) {
          const errorText = await fetchResponse.text();
          throw new Error(`Edge Function error: ${fetchResponse.status} ${errorText}`);
        }
        
        const fetchData = await fetchResponse.json();
        response = { data: fetchData, error: null };
      }

      if (import.meta.env.DEV) {
        logInfo('Response from goal-calculator received', {
          source: 'Goal',
          additionalContext: {
            hasData: !!response.data,
            hasError: !!response.error,
          },
        });
      }

      // Check for HTTP errors first
      if (response.error) {
        const errorMessage = response.error instanceof Error 
          ? response.error.message 
          : (typeof response.error === 'object' && response.error !== null && 'message' in response.error
            ? String((response.error as { message: unknown }).message)
            : 'Unknown error');
        const errorName = response.error instanceof Error
          ? response.error.name
          : (typeof response.error === 'object' && response.error !== null && 'name' in response.error
            ? String((response.error as { name: unknown }).name)
            : 'Error');
        await logError(new Error(errorMessage), {
          source: 'Goal',
          severity: 'high',
          additionalContext: {
            action: 'call_goal_calculator',
            errorCode: errorName,
          },
        });
        throw new Error(`Edge Function Error: ${errorMessage}`);
      }

      // Check if response has data
      if (!response.data) {
        await logError(new Error('No data received from server'), {
          source: 'Goal',
          severity: 'high',
          additionalContext: {
            action: 'call_goal_calculator',
          },
        });
        throw new Error('No data received from server');
      }

      const responseData = response.data as GoalCalculatorResponse;

      // Check for server-side errors in response data
      if (responseData.error) {
        await logError(new Error(responseData.error), {
          source: 'Goal',
          severity: 'high',
          additionalContext: {
            action: 'call_goal_calculator',
            serverError: responseData.error,
          },
        });
        throw new Error(`Server Error: ${responseData.error}`);
      }

      // Check if AI result is present
      if (responseData.ai_result) {
        if (import.meta.env.DEV) {
          logInfo('AI result received', {
            source: 'Goal',
            additionalContext: {
              aiMode: responseData.aiMode,
              hasResult: !!responseData.ai_result,
            },
          });
        }
        
        // Show warning if there was a database issue but calculation succeeded
        if (responseData.warning) {
          logWarning(responseData.warning, {
            source: 'Goal',
            additionalContext: {
              aiMode: responseData.aiMode,
            },
          });
          toast.warning(formatErrorMessage(ErrorMessages.goal.warning, { message: responseData.warning }));
        }
        
        setAiResult(responseData.ai_result);
        
        // Show different success messages based on AI mode
        if (responseData.aiMode === 'local-fallback') {
          toast.success(ErrorMessages.goal.calculateSuccessLocal);
        } else if (responseData.aiMode === 'error-fallback') {
          toast.success(ErrorMessages.goal.calculateSuccessStandard);
        } else {
          toast.success(ErrorMessages.goal.saveSuccess);
        }
      } else {
        await logError(new Error('No AI result in response data'), {
          source: 'Goal',
          severity: 'high',
          additionalContext: {
            action: 'call_goal_calculator',
            responseData: responseData,
          },
        });
        throw new Error('Invalid response: No AI result received from server');
      }
    } catch (error: unknown) {
      // Log error to error tracking service
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const errorInstance = error instanceof Error ? error : new Error(errorMessage);
      
      await logError(errorInstance, {
        source: 'Goal',
        severity: 'high',
        additionalContext: {
          formData: {
            age: formData.age,
            height: formData.height,
            weight: formData.weight,
            gender: formData.gender,
            activity: formData.activity,
            goal_type: formData.goal_type,
            target_time: formData.target_time,
            target_weight: formData.target_weight,
          },
        },
      });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loadingPrevious) {
    return <FullPageLoading message="Memuat data goal sebelumnya..." />;
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-8">
      <Button
        variant="ghost"
        onClick={() => navigate('/')}
        className="mb-6"
        aria-label="Kembali ke halaman utama"
      >
        <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
        Kembali
      </Button>

      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4" aria-hidden="true">
          <Target className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Tentukan Tujuan Kesehatanmu</h1>
        <p className="text-muted-foreground" role="doc-subtitle">
          Buat rencana nutrisi personal berdasarkan tujuan kesehatanmu
        </p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <h2 className="text-2xl font-semibold leading-none tracking-tight mb-2">
            Pilih Tujuanmu
          </h2>
          <CardDescription>
            Apa yang ingin kamu capai dengan PortionPal?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={formData.goal_type}
            onValueChange={(value) => {
              setFormData({ ...formData, goal_type: value as 'lose_weight' | 'reduce_calories' });
              setShowForm(true);
            }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <Label
              htmlFor="lose_weight"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer [&:has([data-state=checked])]:border-primary"
            >
              <RadioGroupItem value="lose_weight" id="lose_weight" className="sr-only" />
              <span className="text-2xl mb-2">🏃‍♀️</span>
              <span className="font-semibold">Menurunkan Berat Badan</span>
            </Label>

            <Label
              htmlFor="reduce_calories"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer [&:has([data-state=checked])]:border-primary"
            >
              <RadioGroupItem value="reduce_calories" id="reduce_calories" className="sr-only" />
              <span className="text-2xl mb-2">🍽️</span>
              <span className="font-semibold">Mengurangi Kalori Harian</span>
            </Label>
          </RadioGroup>
        </CardContent>
      </Card>

      {showForm && (
        <Card className="mb-8">
          <CardHeader>
            <h2 className="text-2xl font-semibold leading-none tracking-tight mb-2">
              Data Pribadi
            </h2>
            <CardDescription>
              Masukkan data dirimu untuk mendapatkan rekomendasi yang akurat
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="age">Usia (tahun)</Label>
                  <Input
                    id="age"
                    type="number"
                    min="10"
                    max="120"
                    value={formData.age}
                    onChange={(e) => {
                      const value = e.target.value;
                      const numValue = value === '' ? 0 : parseInt(value) || 0;
                      setFormData({ ...formData, age: numValue });
                      // Real-time validation
                      const result = goalFormSchema.safeParse({ ...formData, age: numValue });
                      if (!result.success) {
                        const ageError = result.error.errors.find(err => err.path.includes('age'));
                        setFieldErrors(prev => ({ ...prev, age: ageError?.message || '' }));
                      } else {
                        setFieldErrors(prev => {
                          const { age, ...rest } = prev;
                          return rest;
                        });
                      }
                    }}
                    className={fieldErrors.age ? 'border-destructive' : ''}
                    aria-invalid={!!fieldErrors.age}
                    aria-describedby={fieldErrors.age ? 'age-error' : 'age-help'}
                    required
                  />
                  <p id="age-help" className="sr-only">Masukkan usia antara 10 hingga 120 tahun</p>
                  {fieldErrors.age && (
                    <p id="age-error" className="text-sm text-destructive mt-1" role="alert" aria-live="polite">
                      {fieldErrors.age}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender">Jenis Kelamin</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value: 'male' | 'female') => setFormData({ ...formData, gender: value })}
                  >
                    <SelectTrigger id="gender">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Laki-laki</SelectItem>
                      <SelectItem value="female">Perempuan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="height">Tinggi Badan (cm)</Label>
                  <Input
                    id="height"
                    type="number"
                    min="100"
                    max="250"
                    value={formData.height}
                    onChange={(e) => {
                      const value = e.target.value;
                      const numValue = value === '' ? 0 : parseInt(value) || 0;
                      setFormData({ ...formData, height: numValue });
                      // Real-time validation
                      const result = goalFormSchema.safeParse({ ...formData, height: numValue });
                      if (!result.success) {
                        const heightError = result.error.errors.find(err => err.path.includes('height'));
                        setFieldErrors(prev => ({ ...prev, height: heightError?.message || '' }));
                      } else {
                        setFieldErrors(prev => {
                          const { height, ...rest } = prev;
                          return rest;
                        });
                      }
                    }}
                    className={fieldErrors.height ? 'border-destructive' : ''}
                    aria-invalid={!!fieldErrors.height}
                    aria-describedby={fieldErrors.height ? 'height-error' : 'height-help'}
                    required
                  />
                  <p id="height-help" className="sr-only">Masukkan tinggi badan antara 100 hingga 250 cm</p>
                  {fieldErrors.height && (
                    <p id="height-error" className="text-sm text-destructive mt-1" role="alert" aria-live="polite">
                      {fieldErrors.height}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weight">Berat Badan (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    min="30"
                    max="300"
                    value={formData.weight}
                    onChange={(e) => {
                      const value = e.target.value;
                      const numValue = value === '' ? 0 : parseInt(value) || 0;
                      setFormData({ ...formData, weight: numValue });
                      // Real-time validation
                      const result = goalFormSchema.safeParse({ ...formData, weight: numValue });
                      if (!result.success) {
                        const weightError = result.error.errors.find(err => err.path.includes('weight'));
                        setFieldErrors(prev => ({ ...prev, weight: weightError?.message || '' }));
                      } else {
                        setFieldErrors(prev => {
                          const { weight, ...rest } = prev;
                          return rest;
                        });
                      }
                    }}
                    className={fieldErrors.weight ? 'border-destructive' : ''}
                    aria-invalid={!!fieldErrors.weight}
                    aria-describedby={fieldErrors.weight ? 'weight-error' : 'weight-help'}
                    required
                  />
                  <p id="weight-help" className="sr-only">Masukkan berat badan antara 30 hingga 300 kg</p>
                  {fieldErrors.weight && (
                    <p id="weight-error" className="text-sm text-destructive mt-1" role="alert" aria-live="polite">
                      {fieldErrors.weight}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="activity">Aktivitas Harian</Label>
                  <Select
                    value={formData.activity}
                    onValueChange={(value: 'sedentary' | 'moderate' | 'active') => setFormData({ ...formData, activity: value })}
                  >
                    <SelectTrigger id="activity">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sedentary">Rendah (Jarang Bergerak)</SelectItem>
                      <SelectItem value="moderate">Sedang (Olahraga 3-5x/minggu)</SelectItem>
                      <SelectItem value="active">Tinggi (Olahraga Intensif)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="target_time">Target Waktu</Label>
                  <Input
                    id="target_time"
                    type="text"
                    placeholder="contoh: 1 bulan, 3 bulan, 6 bulan, 1 tahun"
                    value={formData.target_time}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData({ ...formData, target_time: value });
                      // Real-time validation
                      const result = goalFormSchema.safeParse({ ...formData, target_time: value });
                      if (!result.success) {
                        const targetTimeError = result.error.errors.find(err => err.path.includes('target_time'));
                        setFieldErrors(prev => ({ ...prev, target_time: targetTimeError?.message || '' }));
                      } else {
                        setFieldErrors(prev => {
                          const { target_time, ...rest } = prev;
                          return rest;
                        });
                      }
                    }}
                    className={fieldErrors.target_time ? 'border-destructive' : ''}
                    aria-invalid={!!fieldErrors.target_time}
                    aria-describedby={fieldErrors.target_time ? 'target_time-error' : 'target_time-help'}
                    required
                  />
                  <p id="target_time-help" className="text-sm text-muted-foreground">
                    Masukkan target waktu dengan format: angka + satuan waktu (contoh: "1 bulan", "3 bulan", "6 bulan", "1 tahun")
                  </p>
                  {fieldErrors.target_time && (
                    <p id="target_time-error" className="text-sm text-destructive mt-1" role="alert" aria-live="polite">
                      {fieldErrors.target_time}
                    </p>
                  )}
                </div>

                {formData.goal_type === 'lose_weight' && (
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="target_weight">Target Berat Badan (kg)</Label>
                    <Input
                      id="target_weight"
                      type="number"
                      min="30"
                      max="300"
                      placeholder="Masukkan target berat badan"
                      value={formData.target_weight || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        const numValue = value === '' ? undefined : parseInt(value) || undefined;
                        setFormData({ ...formData, target_weight: numValue });
                        // Real-time validation
                        const result = goalFormSchema.safeParse({ ...formData, target_weight: numValue });
                        if (!result.success) {
                          const targetWeightError = result.error.errors.find(err => err.path.includes('target_weight'));
                          setFieldErrors(prev => ({ ...prev, target_weight: targetWeightError?.message || '' }));
                        } else {
                          setFieldErrors(prev => {
                            const { target_weight, ...rest } = prev;
                            return rest;
                          });
                        }
                      }}
                      className={fieldErrors.target_weight ? 'border-destructive' : ''}
                      aria-invalid={!!fieldErrors.target_weight}
                      aria-describedby={fieldErrors.target_weight ? 'target_weight-error' : 'target_weight-help'}
                      required
                    />
                    <p id="target_weight-help" className="sr-only">Masukkan target berat badan antara 30 hingga 300 kg, harus kurang dari berat badan saat ini</p>
                    {fieldErrors.target_weight && (
                      <p id="target_weight-error" className="text-sm text-destructive mt-1" role="alert" aria-live="polite">
                        {fieldErrors.target_weight}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                aria-label={loading ? "Sedang menghitung rekomendasi" : "Hitung rekomendasi goal kesehatan"}
                aria-busy={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Menghitung...
                  </>
                ) : (
                  'Hitung Rekomendasi'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {aiResult && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">🎯</span>
              Rekomendasi Personal Untukmu
            </CardTitle>
            <CardDescription>
              Berdasarkan data yang kamu masukkan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-primary/5 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Total Kalori Harian</p>
                <p className="text-3xl font-bold text-primary">
                  {aiResult.daily_calories} <span className="text-lg">kcal</span>
                </p>
              </div>

              <div className="p-4 bg-secondary/10 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Komposisi Makronutrien</p>
                <div className="space-y-1">
                  <p className="font-semibold">
                    Karbo: {aiResult.carbs_percent}% ({aiResult.carbs_grams}g)
                  </p>
                  <p className="font-semibold">
                    Protein: {aiResult.protein_percent}% ({aiResult.protein_grams}g)
                  </p>
                  <p className="font-semibold">
                    Lemak: {aiResult.fat_percent}% ({aiResult.fat_grams}g)
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-semibold mb-2">💡 Saran dari PortionPal AI:</p>
              <p className="text-sm leading-relaxed whitespace-pre-line">
                {aiResult.suggestion}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => navigate('/')}
              >
                Kembali ke Beranda
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  setShowForm(true);
                  setAiResult(null);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                Buat Goal Baru
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
