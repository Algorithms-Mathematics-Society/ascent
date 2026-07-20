import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

/** Shared native input. Validation appearance is driven by `aria-invalid`. */
const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = "text", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn("ascent-field-control ascent-input", className)}
      {...props}
    />
  );
});

export default Input;
