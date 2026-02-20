import { useEffect, useRef, useCallback, RefObject } from 'react';

interface UseFocusTrapOptions {
  /** Whether the focus trap is active */
  isActive: boolean;
  /** Callback when Escape key is pressed */
  onEscape?: () => void;
  /** Whether to restore focus when deactivated */
  restoreFocus?: boolean;
  /** Initial element to focus (selector or ref) */
  initialFocus?: string | RefObject<HTMLElement>;
}

interface UseFocusTrapReturn {
  /** Ref to attach to the container element */
  containerRef: RefObject<HTMLDivElement>;
  /** Handler for keydown events */
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

const FOCUSABLE_SELECTOR = 
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let scrollLockCount = 0;
let originalOverflow: string | null = null;

/**
 * Hook to trap focus within a container element.
 * Useful for modals, dialogs, and other overlay components.
 * 
 * @example
 * ```tsx
 * const { containerRef, handleKeyDown } = useFocusTrap({
 *   isActive: isOpen,
 *   onEscape: onClose,
 * });
 * 
 * return (
 *   <div ref={containerRef} onKeyDown={handleKeyDown}>
 *     ...
 *   </div>
 * );
 * ```
 */
export const useFocusTrap = ({
  isActive,
  onEscape,
  restoreFocus = true,
  initialFocus,
}: UseFocusTrapOptions): UseFocusTrapReturn => {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Store the previously focused element and set initial focus
  useEffect(() => {
    if (isActive) {
      // Save current focus
      previousFocusRef.current = document.activeElement as HTMLElement;
      
      // Prevent body scroll (support nested modals)
      if (scrollLockCount === 0) {
        originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
      }
      scrollLockCount += 1;

      // Set initial focus
      const setInitialFocus = () => {
        if (!containerRef.current) return;

        let elementToFocus: HTMLElement | null = null;

        if (initialFocus) {
          if (typeof initialFocus === 'string') {
            elementToFocus = containerRef.current.querySelector(initialFocus);
          } else if (initialFocus.current) {
            elementToFocus = initialFocus.current;
          }
        }

        if (!elementToFocus) {
          // Focus first focusable element
          elementToFocus = containerRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        }

        elementToFocus?.focus();
      };

      // Small delay to ensure DOM is ready
      const timeoutId = setTimeout(setInitialFocus, 50);

      return () => {
        clearTimeout(timeoutId);
        scrollLockCount = Math.max(0, scrollLockCount - 1);
        if (scrollLockCount === 0 && originalOverflow !== null) {
          document.body.style.overflow = originalOverflow;
        }
        
        // Restore focus
        if (restoreFocus && previousFocusRef.current) {
          previousFocusRef.current.focus();
        }
      };
    }
  }, [isActive, initialFocus, restoreFocus]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isActive || !containerRef.current) return;

    // Handle Escape
    if (e.key === 'Escape' && onEscape) {
      e.preventDefault();
      e.stopPropagation();
      onEscape();
      return;
    }

    // Handle Tab for focus trap
    if (e.key === 'Tab') {
      const focusableElements = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      
      if (focusableElements.length === 0) {
        e.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (e.shiftKey) {
        // Shift + Tab: go backwards
        if (activeElement === firstElement || !containerRef.current.contains(activeElement)) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: go forwards
        if (activeElement === lastElement || !containerRef.current.contains(activeElement)) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  }, [isActive, onEscape]);

  return {
    containerRef,
    handleKeyDown,
  };
};

export default useFocusTrap;
