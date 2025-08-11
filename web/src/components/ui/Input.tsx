import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", type = "text", ...props }, ref) => (
    <input ref={ref} type={type} className={`${type === 'checkbox' || type === 'radio' ? '' : 'form-input'} ${className}`} {...props} />
  )
);

Input.displayName = "Input";

export default Input;
