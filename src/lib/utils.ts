/**
 * Utility Functions
 * 
 * Common utility functions used throughout the application.
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge and deduplicate Tailwind CSS class names
 * 
 * Combines multiple class name inputs, resolves conflicts using Tailwind's
 * merge algorithm, and returns a single optimized class string.
 * 
 * @param inputs - Variable number of class name inputs (strings, objects, arrays)
 * @returns Merged and deduplicated class string
 * 
 * @example
 * ```ts
 * cn('px-2 py-1', 'px-4') // Returns 'py-1 px-4' (px-2 is overridden by px-4)
 * cn('bg-red-500', { 'bg-blue-500': isActive }) // Conditionally applies classes
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
