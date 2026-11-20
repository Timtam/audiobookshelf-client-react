'use client'

import { mergeClasses } from '@/lib/merge-classes'
import Link from 'next/link'
import React, { useState } from 'react'

interface ButtonBaseProps {
  id?: string
  to?: string
  children: React.ReactNode
  disabled?: boolean
  borderless?: boolean
  size?: 'small' | 'medium' | 'large' | 'auto' | 'custom'
  onClick?: (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void
  onMouseDown?: (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement | HTMLAnchorElement>) => void
  onFocus?: (e: React.FocusEvent<HTMLButtonElement | HTMLAnchorElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLButtonElement | HTMLAnchorElement>) => void
  type?: 'button' | 'submit' | 'reset'
  ariaLabel?: string
  className?: string
  ref?: React.Ref<HTMLButtonElement>
  // Allow any additional HTML attributes
  [key: string]: unknown
}

const ButtonBase = ({
  id,
  to,
  children,
  disabled = false,
  borderless = false,
  size = 'medium',
  className = '',
  onClick,
  onMouseDown,
  onKeyDown,
  onFocus,
  onBlur,
  type = 'button',
  ariaLabel,
  ref,
  ...props
}: ButtonBaseProps) => {
  // The browser takes the focus away from a button that gets disabled, and a screen reader loses its place.
  // So a button that gets disabled while it has the focus (Save, a loading button, a stepper at its limit)
  // keeps it and is only marked as disabled, until the focus moves on. It looks the same, see the
  // disabled variant in globals.css.
  const [hasFocus, setHasFocus] = useState(false)
  const keepsFocus = disabled && hasFocus

  const buttonClass = mergeClasses(
    // Base styles
    'relative shadow-md border border-border rounded-md bg-primary flex items-center justify-center overflow-hidden',

    // Focus styles
    'focus-visible:outline-1 focus-visible:outline-foreground-muted focus-visible:outline-offset-0',

    // Size-based height (identical to InputWrapper)
    size === 'small' ? 'h-9' : size === 'large' ? 'h-11' : size === 'auto' ? 'min-h-10 h-auto' : size === 'custom' ? '' : 'h-10',

    // Disabled styles
    'disabled:bg-bg-disabled disabled:cursor-not-allowed disabled:border-none disabled:text-disabled',

    // Borderless styles
    borderless ? 'border-0 bg-transparent shadow-none text-button-foreground-muted' : 'border',

    // Before pseudo-element (replacing abs-btn::before)
    'before:content-[""] before:absolute before:inset-0 before:bg-transparent before:pointer-events-none',

    // Hover styles
    borderless ? 'hover:not-disabled:text-button-foreground' : 'hover:not-disabled:before:bg-bg-hover',

    // Custom className
    className
  )

  const handleClick = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    // A submit button that only keeps the focus must not submit its form
    if (keepsFocus) e.preventDefault()
    if (onClick && !disabled) {
      onClick(e)
    }
  }

  const isDisabled = disabled

  if (to) {
    return (
      <Link
        href={to}
        className={buttonClass}
        onClick={handleClick}
        onMouseDown={onMouseDown}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        style={{ pointerEvents: isDisabled ? 'none' : 'auto' }}
        tabIndex={isDisabled ? -1 : 0}
        aria-disabled={isDisabled}
        aria-label={ariaLabel}
        {...props}
      >
        {children}
      </Link>
    )
  }

  return (
    <button
      id={id}
      ref={ref}
      type={type}
      disabled={disabled && !keepsFocus}
      aria-disabled={keepsFocus || undefined}
      className={buttonClass}
      onClick={handleClick}
      onMouseDown={onMouseDown}
      onKeyDown={onKeyDown}
      onFocus={(e) => {
        setHasFocus(true)
        onFocus?.(e)
      }}
      onBlur={(e) => {
        // The button still has the focus when it is only the window that loses it
        if (document.activeElement !== e.currentTarget) setHasFocus(false)
        onBlur?.(e)
      }}
      aria-label={ariaLabel}
      {...props}
    >
      {children}
    </button>
  )
}

export default ButtonBase
