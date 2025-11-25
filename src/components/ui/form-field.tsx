import React from "react";
import { Label } from "./label";
import { Input } from "./input";
import { Textarea } from "./textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { cn } from "@/lib/utils";

/**
 * FormField - Wrapper for form inputs with consistent label and error styling
 */
interface BaseFormFieldProps {
  label: string;
  id?: string;
  error?: string;
  required?: boolean;
  description?: string;
  className?: string;
}

interface InputFormFieldProps extends BaseFormFieldProps {
  type?: "text" | "email" | "tel" | "password" | "number";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
}

export function FormField({
  label,
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  required,
  description,
  disabled,
  maxLength,
  className
}: InputFormFieldProps) {
  const fieldId = id || label.toLowerCase().replace(/\s+/g, "_");

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={fieldId}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Input
        id={fieldId}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        className={error ? "border-destructive" : ""}
      />
      {description && <p className="text-xs text-farm-muted">{description}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/**
 * TextareaField - Textarea variant of FormField
 */
interface TextareaFormFieldProps extends BaseFormFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
}

export function TextareaField({
  label,
  id,
  value,
  onChange,
  placeholder,
  error,
  required,
  description,
  disabled,
  rows = 4,
  className
}: TextareaFormFieldProps) {
  const fieldId = id || label.toLowerCase().replace(/\s+/g, "_");

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={fieldId}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Textarea
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className={error ? "border-destructive" : ""}
      />
      {description && <p className="text-xs text-farm-muted">{description}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/**
 * SelectField - Select variant of FormField
 */
interface SelectFormFieldProps extends BaseFormFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  disabled?: boolean;
}

export function SelectField({
  label,
  id,
  value,
  onChange,
  options,
  placeholder,
  error,
  required,
  description,
  disabled,
  className
}: SelectFormFieldProps) {
  const fieldId = id || label.toLowerCase().replace(/\s+/g, "_");

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={fieldId}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={fieldId} className={error ? "border-destructive" : ""}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description && <p className="text-xs text-farm-muted">{description}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

