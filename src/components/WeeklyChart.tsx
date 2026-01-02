import { Card } from "@/components/ui/card";

type WeeklyItem = { day: string; score: number };

export const WeeklyChart = ({
  data,
}: {
  data?: WeeklyItem[];
}) => {
  const maxScore = 10;
  const weeklyData: WeeklyItem[] = data && data.length
    ? data
    : [
        { day: "Sen", score: 7.5 },
        { day: "Sel", score: 8.0 },
        { day: "Rab", score: 7.8 },
        { day: "Kam", score: 8.5 },
        { day: "Jum", score: 8.2 },
        { day: "Sab", score: 8.8 },
        { day: "Min", score: 8.3 },
      ];

  const highest = Math.max(...weeklyData.map((i) => i.score));
  const lowest = Math.min(...weeklyData.map((i) => i.score));
  const average = weeklyData.reduce((a, b) => a + b.score, 0) / weeklyData.length;

  return (
    <Card className="gradient-card p-6 space-y-4">
      <h3 className="font-semibold text-lg">Tren Health Score Mingguan</h3>
      
      <div className="space-y-3">
        {weeklyData.map((item, index) => (
          <div key={index} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{item.day}</span>
              <span className="text-muted-foreground">{item.score}/10</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-shadow rounded-full transition-all duration-500"
                style={{ width: `${(item.score / maxScore) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Tertinggi</p>
            <p className="text-lg font-bold text-success">{highest.toFixed(1)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Rata-rata</p>
            <p className="text-lg font-bold text-primary">{average.toFixed(1)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Terendah</p>
            <p className="text-lg font-bold text-warning">{lowest.toFixed(1)}</p>
          </div>
        </div>
      </div>
    </Card>
  );
};
