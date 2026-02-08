import { Input } from "@/components/ui/input";
import { forwardRef, useCallback } from "react";

export function parseBRL(formatted: string): number {
  if (!formatted) return 0;
  const cleaned = formatted.replace(/\./g, "").replace(",", ".");
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

export function formatBRL(value: number): string {
  if (!value && value !== 0) return "";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function centsToFormatted(cents: number): string {
  return formatBRL(cents / 100);
}

interface CurrencyInputProps {
  value: string;
  onChange: (formatted: string) => void;
  placeholder?: string;
  className?: string;
  "data-testid"?: string;
  id?: string;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, placeholder = "0,00", className, ...props }, ref) => {
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        const digits = raw.replace(/\D/g, "");
        if (digits === "") {
          onChange("");
          return;
        }
        const cents = parseInt(digits, 10);
        const reais = cents / 100;
        const formatted = reais.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        onChange(formatted);
      },
      [onChange]
    );

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={className}
        {...props}
      />
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";
