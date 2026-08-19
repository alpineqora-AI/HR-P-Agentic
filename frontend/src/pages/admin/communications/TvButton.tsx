import React from 'react';
import './TvButton.css';

const cn = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Button variant
   */
  variant?: 'primary' | 'secondary' | 'tertiary' | 'destructive' | 'ghost';
  /**
   * Button size
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Full width button
   */
  fullWidth?: boolean;
  /**
   * Loading state
   */
  loading?: boolean;
  /**
   * Icon before text
   */
  iconBefore?: React.ReactNode;
  /**
   * Icon after text
   */
  iconAfter?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      loading = false,
      disabled,
      children,
      iconBefore,
      iconAfter,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          'tv-button',
          `tv-button--${variant}`,
          `tv-button--${size}`,
          fullWidth && 'tv-button--full-width',
          loading && 'tv-button--loading',
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <span className="tv-button__spinner">
            <svg viewBox="0 0 24 24" fill="none" className="tv-button__spinner-icon">
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                className="tv-button__spinner-circle"
              />
            </svg>
          </span>
        )}
        {!loading && iconBefore && <span className="tv-button__icon-before">{iconBefore}</span>}
        <span className="tv-button__text">{children}</span>
        {!loading && iconAfter && <span className="tv-button__icon-after">{iconAfter}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
