import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/** Native select sharing Input's interaction and validation states. */
const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn("ascent-field-control ascent-select", className)}
      {...props}
    >
      {children}
    </select>
  );
});

export default Select;
