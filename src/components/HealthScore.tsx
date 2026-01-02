import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";

interface HealthScoreProps {
  score: number;
  confidence?: number;
}

export const HealthScore = ({ score, confidence }: HealthScoreProps) => {
  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-success";
    if (score >= 6) return "text-warning";
    return "text-destructive";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 8) return "Sangat Baik! 🌟";
    if (score >= 6) return "Cukup Baik 👍";
    return "Perlu Perbaikan 💪";
  };

  return (
    <Card className="gradient-card p-6 text-center space-y-2">
      <p className="text-sm text-muted-foreground">Health Score</p>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 10 }}
      >
        <p className={`text-4xl font-bold ${getScoreColor(score)}`}>
          {score}
        </p>
      </motion.div>
      <p className="text-xs font-medium">{getScoreLabel(score)}</p>
      {typeof confidence === 'number' && (
        <p className="text-xs text-muted-foreground">Confidence: {Math.round(confidence)}%</p>
      )}
      <div className="w-full bg-secondary rounded-full h-2 mt-2">
        <motion.div
          className="bg-gradient-to-r from-primary to-shadow h-2 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${score * 10}%` }}
          transition={{ duration: 1, delay: 0.2 }}
        />
      </div>
    </Card>
  );
};
