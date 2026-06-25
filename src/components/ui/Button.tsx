// src/components/ui/Button.tsx
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "hot";
type Size = "sm" | "md" | "lg";

const SIZE_CLASS: Record<Size, string> = {
  sm: "ascent-btn-sm",
  md: "ascent-btn-md",
  lg: "ascent-btn-lg",
};

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "ascent-btn-primary",
  secondary: "ascent-btn-secondary",
  hot: "ascent-btn-hot",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

type ButtonAsLink = CommonProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };
type ButtonAsButton = CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

/** Typed wrapper over the .ascent-btn class family. Renders <a> when href is set. */
export default function Button(props: ButtonAsLink | ButtonAsButton) {
  const {
    variant = "primary",
    size = "md",
    className,
    children,
    ...rest
  } = props;
  const classes = cn(
    "ascent-btn",
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    className,
  );

  if ("href" in props && props.href !== undefined) {
    const anchorProps = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <a className={classes} {...anchorProps}>
        {children}
      </a>
    );
  }

  const buttonProps = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button type="button" className={classes} {...buttonProps}>
      {children}
    </button>
  );
}
