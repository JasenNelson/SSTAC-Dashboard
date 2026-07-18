// src/components/dashboard/ShareButton.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface ShareButtonProps {
  title?: string;
  url?: string;
  description?: string;
  className?: string;
}

// A11y notes:
//   - The trigger is a native <button>, so Enter/Space already activate it
//     via default browser behavior; no extra keydown handling is needed to
//     open the menu from the keyboard.
//   - Opening the fallback menu (click or keyboard activation of the
//     trigger) moves focus to the first menu item. This is required, not
//     cosmetic: the keydown handler that implements Arrow navigation is
//     attached to the menu container, and keydown events on the trigger
//     (a sibling element) do not bubble into it. Without this, ArrowDown /
//     ArrowUp pressed immediately after opening would do nothing until the
//     user manually Tabbed focus into a menu item.
//   - Esc closes the menu and returns focus to the trigger button.
//   - ArrowDown / ArrowUp navigate between menu items while the menu is open.
//   - Click outside the menu (the existing backdrop) dismisses it.
//   - aria-haspopup / aria-expanded / aria-controls on the trigger and
//     role="menu" / role="menuitem" on the dropdown describe the widget to
//     assistive tech (matches the pattern in
//     src/components/engine-v2/ExportFormatMenu.tsx).
export default function ShareButton({
  title = "BC Sediment Standards Review Dashboard",
  url = typeof window !== 'undefined' ? window.location.href : '',
  description = "Interactive dashboard showcasing expert feedback on modernizing BC's sediment standards",
  className = "",
}: ShareButtonProps) {
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const shareData = {
    title,
    text: description,
    url,
  };

  // Close the menu and return focus to the trigger button.
  const closeMenu = useCallback((): void => {
    setShowShareMenu(false);
    // requestAnimationFrame ensures the trigger is rendered before focusing.
    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }, []);

  // Move focus to the first menu item whenever the fallback menu opens, so
  // Arrow-key navigation is immediately reachable (see the A11y note above).
  useEffect(() => {
    if (!showShareMenu) return;
    const first = menuRef.current?.querySelector<HTMLButtonElement>(
      '[role="menuitem"]',
    );
    first?.focus();
  }, [showShareMenu]);

  // Esc-to-close + ArrowDown/ArrowUp navigation inside the open menu.
  const onMenuKeyDown = useCallback(
    (ev: React.KeyboardEvent<HTMLDivElement>): void => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        closeMenu();
        return;
      }
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        const container = ev.currentTarget;
        const items = Array.from(
          container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
        );
        if (items.length === 0) return;
        const focused = document.activeElement;
        const idx = items.indexOf(focused as HTMLButtonElement);
        if (ev.key === 'ArrowDown') {
          const next = idx < items.length - 1 ? idx + 1 : 0;
          items[next]?.focus();
        } else {
          const prev = idx > 0 ? idx - 1 : items.length - 1;
          items[prev]?.focus();
        }
      }
    },
    [closeMenu],
  );

  // Esc-to-close on the trigger button itself (in case focus is there while
  // the menu is open, e.g. right after it was opened by a click).
  const onTriggerKeyDown = useCallback(
    (ev: React.KeyboardEvent<HTMLButtonElement>): void => {
      if (ev.key === 'Escape' && showShareMenu) {
        ev.preventDefault();
        closeMenu();
      }
    },
    [showShareMenu, closeMenu],
  );

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        setShowShareMenu(false);
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      setShowShareMenu(true);
    }
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent(title);
    const body = encodeURIComponent(`${description}\n\nView the dashboard: ${url}`);
    const mailtoLink = `mailto:?subject=${subject}&body=${body}`;
    window.open(mailtoLink);
    setShowShareMenu(false);
  };

  const handleLinkedInShare = () => {
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&summary=${encodeURIComponent(description)}`;
    window.open(linkedInUrl, '_blank');
    setShowShareMenu(false);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      setShowShareMenu(false);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const handlePrint = () => {
    window.print();
    setShowShareMenu(false);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Main Share Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleNativeShare}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="menu"
        aria-expanded={showShareMenu}
        aria-controls="share-menu"
        className="inline-flex items-center px-4 py-2 bg-sky-700 dark:bg-sky-600 text-white font-medium rounded-lg hover:bg-sky-800 dark:hover:bg-sky-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
        </svg>
        Share Dashboard
      </button>

      {/* Share Menu Dropdown */}
      {showShareMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            aria-hidden="true"
            onClick={() => setShowShareMenu(false)}
          />

          {/* Menu */}
          <div
            ref={menuRef}
            id="share-menu"
            role="menu"
            aria-label="Share options"
            onKeyDown={onMenuKeyDown}
            className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-50"
          >
            <div className="p-2">
              <div className="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-700">
                Share via
              </div>

              {/* Email */}
              <button
                type="button"
                role="menuitem"
                onClick={handleEmailShare}
                className="w-full flex items-center px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-inset"
              >
                <svg className="w-5 h-5 mr-3 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email
              </button>

              {/* LinkedIn */}
              <button
                type="button"
                role="menuitem"
                onClick={handleLinkedInShare}
                className="w-full flex items-center px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-inset"
              >
                <svg className="w-5 h-5 mr-3 text-sky-600 dark:text-sky-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                LinkedIn
              </button>

              {/* Copy Link */}
              <button
                type="button"
                role="menuitem"
                onClick={handleCopyLink}
                className="w-full flex items-center px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-inset"
              >
                <svg className="w-5 h-5 mr-3 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {copied ? 'Copied!' : 'Copy Link'}
              </button>

              {/* Print */}
              <button
                type="button"
                role="menuitem"
                onClick={handlePrint}
                className="w-full flex items-center px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-inset"
              >
                <svg className="w-5 h-5 mr-3 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
