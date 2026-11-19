import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'glass' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className,
  disabled,
  ...props
}) => {
  const baseStyles =
    'relative inline-flex items-center justify-center font-bold transition-colors duration-150 select-none disabled:opacity-50 disabled:pointer-events-none rounded-full';

  const sizeStyles = {
    sm: 'text-xs px-3.5 py-1.5 min-h-[36px] gap-1.5',
    md: 'text-sm px-5 py-2.5 min-h-[44px] gap-2',
    lg: 'text-base px-6 py-3.5 min-h-[50px] gap-2.5 w-full',
  };

  const variantStyles = {
    primary:
      'bg-black text-white hover:bg-slate-900 shadow-md shadow-black/15 border border-black/10',
    secondary:
      'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200/70',
    glass:
      'bg-white/90 text-slate-900 hover:bg-white backdrop-blur-md border border-black/10 shadow-sm',
    danger:
      'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200',
    ghost:
      'bg-transparent text-slate-600 hover:text-black hover:bg-black/5',
  };

  return (
    <motion.button
      whileTap={disabled || isLoading ? undefined : { scale: 0.97 }}
      whileHover={disabled || isLoading ? undefined : { scale: 1.01 }}
      className={clsx(baseStyles, sizeStyles[size], variantStyles[variant], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        <>
          {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
          <span>{children}</span>
          {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
        </>
      )}
    </motion.button>
  );
};
