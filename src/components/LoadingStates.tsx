/**
 * Reusable Loading State Components
 * 
 * Provides consistent loading UI across the application
 */

import { Loader2, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

// ====== Basic Loading Spinner ======

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
}

export function LoadingSpinner({ 
  size = "md", 
  className = "",
  text 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-2 ${className}`}>
      <Loader2 className={`${sizeClasses[size]} animate-spin text-primary`} />
      {text && (
        <p className="text-sm text-muted-foreground">{text}</p>
      )}
    </div>
  );
}

// ====== Full Page Loading ======

interface FullPageLoadingProps {
  message?: string;
}

export function FullPageLoading({ message = "Memuat data..." }: FullPageLoadingProps) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles className="w-16 h-16 text-primary" />
        </motion.div>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

// ====== Card Skeleton Loader ======

export function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <Card className={`p-6 space-y-4 ${className}`}>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-32" />
      </div>
      <Skeleton className="h-20 w-full" />
    </Card>
  );
}

// ====== Meal Card Skeleton ======

export function MealCardSkeleton() {
  return (
    <Card className="gradient-card overflow-hidden">
      <div className="flex gap-4 p-4">
        <Skeleton className="w-24 h-24 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      </div>
    </Card>
  );
}

// ====== Stats Card Skeleton ======

export function StatsCardSkeleton() {
  return (
    <Card className="gradient-card p-5 space-y-2">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-10 w-24" />
      <Skeleton className="h-3 w-20" />
    </Card>
  );
}

// ====== Chart Skeleton ======

export function ChartSkeleton({ height = "200px" }: { height?: string }) {
  return (
    <Card className="p-6">
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
        <div style={{ height }} className="flex items-end gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton
              key={i}
              className="flex-1"
              style={{
                height: `${Math.random() * 60 + 40}%`,
              }}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}

// ====== List Skeleton ======

interface ListSkeletonProps {
  count?: number;
  itemHeight?: string;
}

export function ListSkeleton({ count = 5, itemHeight = "80px" }: ListSkeletonProps) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-4">
          <div className="flex gap-4">
            <Skeleton className="w-16 h-16 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </Card>
      ))}
    </div>
  );
}

// ====== Form Skeleton ======

export function FormSkeleton() {
  return (
    <Card className="p-6 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-10 w-full" />
    </Card>
  );
}

// ====== Image Upload Skeleton ======

export function ImageUploadSkeleton() {
  return (
    <Card className="p-8">
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center space-y-4 py-12">
          <Skeleton className="w-24 h-24 rounded-lg" />
          <div className="space-y-2 text-center">
            <Skeleton className="h-5 w-48 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </div>
        </div>
        <div className="flex gap-2 justify-center">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    </Card>
  );
}

// ====== Table Skeleton ======

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex gap-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton key={colIndex} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ====== Inline Loading ======

interface InlineLoadingProps {
  text?: string;
  size?: "sm" | "md";
}

export function InlineLoading({ text, size = "sm" }: InlineLoadingProps) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Loader2 className={`h-4 w-4 animate-spin ${size === "md" ? "h-5 w-5" : ""}`} />
      {text && <span className="text-sm">{text}</span>}
    </div>
  );
}

// ====== Button Loading ======

interface ButtonLoadingProps {
  text?: string;
}

export function ButtonLoading({ text = "Memproses..." }: ButtonLoadingProps) {
  return (
    <div className="flex items-center gap-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{text}</span>
    </div>
  );
}

