import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCNPJ(value: string | undefined | null) {
  if (!value) return "";
  const numbers = value.replace(/\D/g, "");
  return numbers
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
    .substring(0, 18);
}

export function formatPhone(value: string | undefined | null) {
  if (!value) return "";
  const numbers = value.replace(/\D/g, "");
  
  if (numbers.length <= 10) {
    return numbers
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .substring(0, 14);
  }
  
  return numbers
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .substring(0, 15);
}

export function normalizeNumber(value: string) {
  return value.replace(/\D/g, "");
}

export function decimalToTime(decimal: number | string | undefined | null): string {
  if (!decimal) return "00:00";
  const num = typeof decimal === 'string' ? parseFloat(decimal) : decimal;
  if (isNaN(num)) return "00:00";
  
  const totalMinutes = Math.round(Math.abs(num) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function timeToDecimal(hours: string | number, minutes: string | number): number {
  const h = Number(hours) || 0;
  const m = Number(minutes) || 0;
  return h + (m / 60);
}

