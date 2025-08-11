import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className = "", ...props }, ref) => (
    <button ref={ref} className={`btn ${className}`} {...props} />
  )
);

Button.displayName = "Button";

export default Button;
