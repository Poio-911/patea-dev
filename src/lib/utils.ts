import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatVenueName(name?: string, address?: string) {
  const raw = name || address || '';
  // Split by first comma and take the first part
  return raw.split(',')[0].trim();
}
