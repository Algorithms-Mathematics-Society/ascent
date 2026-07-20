import {
  cloneElement,
  useId,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

type FieldControlProps = {
  id?: string;
  required?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling";
};

export interface FormFieldProps {
  label: ReactNode;
  children: ReactElement<FieldControlProps>;
  id?: string;
  description?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  optional?: boolean;
  className?: string;
}

/**
 * Wires a label, supporting copy, and validation message to one native control.
 * The child must accept standard field id, required, and ARIA props.
 */
export default function FormField({
  label,
  children,
  id: providedId,
  description,
  error,
  required,
  optional,
  className,
}: FormFieldProps) {
  const generatedId = useId();
  const controlId = providedId ?? children.props.id ?? generatedId;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [
    children.props["aria-describedby"],
    descriptionId,
    errorId,
  ]
    .filter(Boolean)
    .join(" ");

  const control = cloneElement(children, {
    id: controlId,
    ...(required === undefined ? {} : { required }),
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
    ...(error ? { "aria-invalid": true } : {}),
  });

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label
        htmlFor={controlId}
        className="text-sm font-semibold leading-5 text-ascent-ink"
      >
        {label}
        {optional && !required ? (
          <span className="ml-1 font-normal text-ascent-muted">(optional)</span>
        ) : null}
      </label>
      {description ? (
        <p id={descriptionId} className="text-sm leading-5 text-ascent-muted">
          {description}
        </p>
      ) : null}
      {control}
      {error ? (
        <p
          id={errorId}
          className="text-sm leading-5 text-ascent-danger"
          aria-live="polite"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
