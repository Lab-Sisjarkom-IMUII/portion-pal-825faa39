import { Card } from "@/components/ui/card";

interface MacroChartProps {
  data: {
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
}

export const MacroChart = ({ data }: MacroChartProps) => {
  const total = data.protein + data.carbs + data.fat + data.fiber;
  
  // Helper to calculate percentage safely (avoid NaN/Infinity)
  const calcPercentage = (value: number): string => {
    if (total === 0 || !isFinite(value) || !isFinite(total)) {
      return "0.0";
    }
    const percentage = (value / total) * 100;
    return isFinite(percentage) ? percentage.toFixed(1) : "0.0";
  };
  
  const chartData = [
    { name: "Protein", value: data.protein, color: "hsl(var(--chart-1))", percentage: calcPercentage(data.protein) },
    { name: "Karbohidrat", value: data.carbs, color: "hsl(var(--chart-3))", percentage: calcPercentage(data.carbs) },
    { name: "Lemak", value: data.fat, color: "hsl(var(--chart-4))", percentage: calcPercentage(data.fat) },
    { name: "Serat", value: data.fiber, color: "hsl(var(--chart-2))", percentage: calcPercentage(data.fiber) },
  ];

  return (
    <Card className="gradient-card p-6 space-y-4">
      <h2 className="text-xl font-semibold">Visualisasi Porsi</h2>
      
      {/* Bar Chart */}
      <div className="space-y-3">
        {chartData.map((item, index) => (
          <div key={index} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{item.name}</span>
              <span className="text-muted-foreground">{item.value}g ({item.percentage}%)</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${item.percentage}%`,
                  backgroundColor: item.color
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Legend Circles */}
      <div className="flex flex-wrap gap-4 pt-2">
        {chartData.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-muted-foreground">{item.name}</span>
          </div>
        ))}
      </div>
    </Card>
  );
};
