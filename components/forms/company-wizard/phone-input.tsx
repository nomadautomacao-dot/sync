"use client";

import { Input } from "@/components/ui/input";
import { maskPhone } from "@/components/forms/company-wizard/formatters";

interface PhoneInputProps {
  id: string;
  value?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function PhoneInput({
  id,
  value = "",
  onChange,
  onBlur,
  disabled,
  placeholder = "(11) 99999-9999",
}: PhoneInputProps) {
  return (
    <Input
      id={id}
      value={maskPhone(value)}
      onChange={(event) => onChange(maskPhone(event.target.value))}
      onBlur={onBlur}
      disabled={disabled}
      placeholder={placeholder}
    />
  );
}
