import { Card } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import type { PortionBreakdown } from "@/lib/aiAnalysis";

interface PortionChartProps {
  data: PortionBreakdown;
  confidenceScore?: number;
}

export function PortionChart({ data, confidenceScore }: PortionChartProps) {
  // Ensure values are numbers and not NaN
  const carbsPct = typeof data.carbs_percentage === 'number' && isFinite(data.carbs_percentage) ? data.carbs_percentage : 0;
  const proteinPct = typeof data.protein_percentage === 'number' && isFinite(data.protein_percentage) ? data.protein_percentage : 0;
  const vegetablesPct = typeof data.vegetables_percentage === 'number' && isFinite(data.vegetables_percentage) ? data.vegetables_percentage : 0;
  
  const chartData = [
    { name: "Karbohidrat", value: carbsPct, color: "hsl(var(--chart-3))" },
    { name: "Protein", value: proteinPct, color: "hsl(var(--chart-1))" },
    { name: "Sayur", value: vegetablesPct, color: "hsl(var(--chart-2))" },
  ].filter(item => item.value > 0);

  const isAccurate = confidenceScore ? confidenceScore >= 80 : true;

  return (
    <Card className="gradient-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Distribusi Porsi Makanan</h2>
        {confidenceScore !== undefined && (
          <div className="flex items-center gap-2">
            <div className={`text-sm font-medium ${isAccurate ? 'text-success' : 'text-warning'}`}>
              Akurasi: {confidenceScore}%
            </div>
          </div>
        )}
      </div>

      {!isAccurate && confidenceScore !== undefined && (
        <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg text-sm text-warning">
          ⚠️ Hasil deteksi kurang akurat. Coba foto dengan pencahayaan lebih baik 📸
        </div>
      )}

      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) => `${name}: ${value}%`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => `${value}%`}
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-3 bg-chart-3/10 rounded-lg">
          <div className="text-2xl font-bold text-chart-3">{carbsPct}%</div>
          <div className="text-xs text-muted-foreground mt-1">🍚 Karbohidrat</div>
        </div>
        <div className="text-center p-3 bg-chart-1/10 rounded-lg">
          <div className="text-2xl font-bold text-chart-1">{proteinPct}%</div>
          <div className="text-xs text-muted-foreground mt-1">🍗 Protein</div>
        </div>
        <div className="text-center p-3 bg-chart-2/10 rounded-lg">
          <div className="text-2xl font-bold text-chart-2">{vegetablesPct}%</div>
          <div className="text-xs text-muted-foreground mt-1">🥦 Sayur</div>
        </div>
      </div>

      <div className="pt-4 border-t text-sm text-muted-foreground">
        <p className="mb-2">📊 <strong>Rekomendasi Porsi Sehat:</strong></p>
        <ul className="space-y-1 text-xs">
          <li>• Karbohidrat: 40-50% (nasi, roti, pasta)</li>
          <li>• Protein: 25-35% (ayam, ikan, tahu, tempe)</li>
          <li>• Sayur: 20-30% (sayuran hijau, wortel, tomat)</li>
        </ul>
      </div>
    </Card>
  );
}
