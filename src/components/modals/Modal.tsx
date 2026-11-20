'use client'

import LoadingIndicator from '@/components/ui/LoadingIndicator'
import { ModalProvider } from '@/contexts/ModalContext'
import { useClickOutside } from '@/hooks/useClickOutside'
import { getTopmostModalElement, useModalHistory } from '@/hooks/useModalHistory'
import { useTypeSafeTranslations } from '@/hooks/useTypeSafeTranslations'
import { getFocusableElements, trapTabKey } from '@/lib/focusTrap'
import { mergeClasses } from '@/lib/merge-classes'
import React, { ReactNode, useCallback, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

export const MODAL_ROOT_SELECTOR = '[data-abs-modal]'
const OPEN_COMBOBOX_SELECTOR = '[role="combobox"][aria-expanded="true"]'

export function isAbsModalOpen(): boolean {
  return document.querySelector(MODAL_ROOT_SELECTOR) !== null
}

export interface ModalProps {
  isOpen: boolean
  processing?: boolean
  persistent?: boolean
  zIndexClass?: string
  bgOpacityClass?: string
  children?: ReactNode
  outerContent?: ReactNode
  sideNavigation?: ReactNode
  onClose?: () => void
  className?: string
  style?: React.CSSProperties
  /** Id of the element that names the dialog. Defaults to the outer content (the title above the panel). */
  ariaLabelledBy?: string
  ariaDescribedBy?: string
}

export default function Modal({
  isOpen,
  processing = false,
  persistent = false,
  zIndexClass = 'z-70',
  bgOpacityClass = 'bg-primary/75',
  children,
  outerContent,
  sideNavigation,
  onClose,
  className,
  style,
  ariaLabelledBy,
  ariaDescribedBy
}: ModalProps) {
  const t = useTypeSafeTranslations()
  const outerContentId = useId()

  const wrapperRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useModalHistory(isOpen, wrapperRef, onClose, processing || persistent)

  const clickClose = useCallback(() => {
    onClose?.()
  }, [onClose])

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (!isOpen || processing || persistent) return

      // Only close if the click occurred strictly within this modal's wrapper.
      // If the click was on a nested modal (which is a sibling in the DOM due to portals),
      // wrapperRef.current.contains(taget) will be false, so we ignore it.
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        return
      }

      onClose?.()
    },
    [isOpen, processing, persistent, onClose]
  )

  // Use click outside hook
  useClickOutside(contentRef, null, handleClickOutside)

  const previousActiveElement = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement
      // Focus the modal content when it opens
      // We use requestAnimationFrame to ensure the element is ready to receive focus
      requestAnimationFrame(() => {
        // Unless something inside took the focus already, like the first button of a confirm dialog
        if (!contentRef.current?.contains(document.activeElement)) contentRef.current?.focus()
      })
    }
    return () => {
      // Restore focus when modal closes or unmounts (if it was open)
      if (isOpen && previousActiveElement.current) {
        previousActiveElement.current.focus()
      }
    }
  }, [isOpen])

  // The focus stays inside the open modal, and at the same place. A focused control that gets removed or
  // gives the focus up would drop it to the page behind the modal, where a screen reader loses its position.
  // (A button that gets disabled keeps the focus by itself, see ButtonBase.)
  useEffect(() => {
    const content = contentRef.current
    if (!isOpen || !content) return

    const countControlsBefore = (element: HTMLElement, root: HTMLElement = content) =>
      getFocusableElements(root).filter((control) => control.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING).length

    /** The control that had the focus last, and how many controls of the modal came before it */
    let last: { element: HTMLElement; position: number } = { element: content, position: 0 }

    const rememberFocus = (e: FocusEvent) => {
      const element = e.target as HTMLElement
      last = { element, position: countControlsBefore(element) }
    }

    // Back to that control. If it is disabled now or gone, the control that comes right after its place gets the focus.
    const restoreFocus = () => {
      if (document.activeElement !== document.body || getTopmostModalElement() !== wrapperRef.current) return
      last.element.focus()
      if (document.activeElement !== document.body) return
      const controls = getFocusableElements(content)
      // Of the controls that came before a removed one, those that were removed along with it do not count anymore
      const position = last.element.isConnected
        ? countControlsBefore(last.element)
        : last.position - countControlsBefore(last.element, last.element.getRootNode() as HTMLElement)
      ;(controls[Math.min(position, controls.length - 1)] ?? content).focus()
    }
    // Before the next frame, once the code that took the focus away or changed the modal is done.
    // Not right away, because the focus is nowhere for a moment as well while it moves to another control.
    const checkFocus = () => requestAnimationFrame(restoreFocus)
    // A removed control gives no sign, so also look when the page changes while the focus is nowhere
    const observer = new MutationObserver(() => {
      if (document.activeElement === document.body) checkFocus()
    })

    observer.observe(document.body, { childList: true, subtree: true, attributes: true })
    content.addEventListener('focusin', rememberFocus)
    content.addEventListener('focusout', checkFocus)
    return () => {
      observer.disconnect()
      content.removeEventListener('focusin', rememberFocus)
      content.removeEventListener('focusout', checkFocus)
    }
  }, [isOpen])

  // Close on Escape even when focus is outside the modal (e.g. after blurring a field
  // or using episode prev/next navigation). Only the topmost nested modal should respond.
  useEffect(() => {
    if (!isOpen) return

    const handleDocumentKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || processing || persistent) return
      if (document.querySelector(OPEN_COMBOBOX_SELECTOR)) return

      if (getTopmostModalElement() !== wrapperRef.current) return

      e.preventDefault()
      e.stopImmediatePropagation()
      onClose?.()
    }

    document.addEventListener('keydown', handleDocumentKeyDown, { capture: true })
    return () => document.removeEventListener('keydown', handleDocumentKeyDown, { capture: true })
  }, [isOpen, processing, persistent, onClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Key presses in a nested modal arrive here as well, and its Tab key must not move the focus into this one
    if (getTopmostModalElement() === wrapperRef.current) trapTabKey(e, contentRef.current)
  }, [])

  if (!isOpen) {
    return null
  }

  const modalContent = (
    <div
      ref={wrapperRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy ?? (outerContent ? outerContentId : undefined)}
      aria-describedby={ariaDescribedBy}
      data-abs-modal
      className={mergeClasses(
        'modal modal-bg safe-px fixed inset-s-0 top-0 flex h-full w-full items-center justify-center overflow-x-hidden pt-[50px] pb-2',
        zIndexClass,
        bgOpacityClass
      )}
      cy-id="modal-wrapper"
      onKeyDown={handleKeyDown}
    >
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-36 w-full bg-linear-to-t from-transparent via-gray-900/50 to-gray-800/70 opacity-90" />

      {/* Close button */}
      <button
        className="safe-end-2 sm:safe-end-4 absolute top-2 z-10 inline-flex text-gray-200 transition-colors hover:text-white sm:top-4"
        aria-label={t('ButtonCloseModal')}
        onClick={clickClose}
        cy-id="modal-close-button"
      >
        <span className="material-symbols text-xl sm:text-2xl" aria-hidden="true">
          close
        </span>
      </button>

      {/* Outer content slot */}
      {outerContent && (
        <div id={outerContentId} className="contents">
          {outerContent}
        </div>
      )}

      {/* Focus trap + optional side rails + panel */}
      <div
        ref={contentRef}
        tabIndex={0}
        className="relative flex max-h-full flex-col outline-none focus:outline-none"
        cy-id="modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {sideNavigation}
        <div
          style={style}
          className={mergeClasses(
            'text-foreground shadow-modal-content bg-bg relative rounded-lg',
            // Never taller than the viewport (e.g. phones in landscape)
            'fit-column',
            // Responsive width: full width with margin on mobile, fixed width on larger screens
            'w-[calc(var(--content-vw)-1rem)] max-w-[calc(var(--content-vw)*0.9)] sm:max-w-[600px] md:max-w-[700px] lg:max-w-[800px]',
            className
          )}
          cy-id="modal-panel"
        >
          <ModalProvider modalRef={wrapperRef as React.RefObject<HTMLDivElement>}>{children}</ModalProvider>

          {/* Processing overlay */}
          {processing && (
            <div className="absolute inset-0 flex h-full w-full items-center justify-center rounded-lg bg-gray-900/60" cy-id="modal-processing-overlay">
              <LoadingIndicator />
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
