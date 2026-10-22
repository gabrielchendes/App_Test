import React, { useState, useEffect, useRef, useCallback } from 'react';
import { registerNoticeListener, NoticeOptions } from '../lib/notice';
import './NoticeBoard.css';

const ICONS = {
  success: (
    <>
      <path className="draw" d="M7 12.5l3.2 3.2L17 8.8" />
      <circle cx="12" cy="12" r="9" />
    </>
  ),
  error: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.4v.1" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.6v.1" />
    </>
  ),
};

const esc = (s: string) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c));

export const NoticeBoard: React.FC = () => {
  const [notice, setNotice] = useState<NoticeOptions | null>(null);
  const [isRendered, setIsRendered] = useState(false);
  const [stateClass, setStateClass] = useState<'show' | 'leave' | ''>('');
  const timerRef = useRef<any>(null);
  const onDoneRef = useRef<(() => void) | null>(null);

  const close = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setStateClass('leave');
    const f = onDoneRef.current;
    onDoneRef.current = null;
    if (f) {
      try {
        f();
      } catch (err) {
        console.error(err);
      }
    }
    setTimeout(() => {
      setIsRendered(false);
      setNotice(null);
      setStateClass('');
    }, 260);
  }, []);

  useEffect(() => {
    const unregister = registerNoticeListener((newNotice) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (!newNotice) {
        close();
        return;
      }

      onDoneRef.current = newNotice.onClose || null;
      setNotice(newNotice);
      setIsRendered(true);
      setStateClass('');

      // Smooth top slide-in animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setStateClass('show');
        });
      });

      // Auto-dismiss automatically after 4.5 seconds (or caller's autoClose)
      const autoCloseMs = newNotice.autoClose !== undefined ? newNotice.autoClose : 4500;
      if (autoCloseMs && autoCloseMs > 0) {
        timerRef.current = setTimeout(() => {
          close();
        }, autoCloseMs);
      }
    });

    return () => {
      unregister();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [close]);

  useEffect(() => {
    if (!isRendered) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRendered, close]);

  if (!isRendered || !notice) return null;

  const type = notice.type || 'success';
  const eyebrow =
    notice.eyebrow ||
    (type === 'success' ? 'All done' : type === 'error' ? 'Something went wrong' : 'Heads up');
  const buttonText =
    notice.button || (type === 'error' ? 'Try again' : type === 'info' ? 'Got it' : 'Continue');

  // Format title with *word* into <em>word</em>
  const rawTitle = typeof notice.title === 'string' ? notice.title : '';
  const parsedTitleHtml = rawTitle ? esc(rawTitle).replace(/\*(.+?)\*/g, '<em>$1</em>') : '';

  return (
    <aside className="notice-top-container" aria-live="polite">
      <main
        className={`notice-modal-root t-${type} ${stateClass}`}
        role="alertdialog"
        aria-labelledby="nTitle"
        aria-describedby="nText"
      >
        <div
          className="board"
          onClick={close}
          title="Click to dismiss"
        >
          <section className="card">
            {/* Close button with X icon */}
            <button
              className="close"
              id="btnClose"
              aria-label="Close notice"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                close();
              }}
            >
              <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M1 1l12 12M13 1L1 13" />
              </svg>
            </button>

            {/* Eyebrow with gold gradient lines */}
            {eyebrow && <div className="eyebrow" id="nEyebrow">{eyebrow}</div>}

            {/* Medallion with spinning dashed outer ring and animated SVG icon */}
            <div className="medallion">
              {notice.icon ? (
                typeof notice.icon === 'string' ? (
                  <span className="text-base sm:text-xl leading-none select-none">{notice.icon}</span>
                ) : (
                  notice.icon
                )
              ) : (
                <svg viewBox="0 0 24 24" id="nIcon">
                  {ICONS[type] || ICONS.success}
                </svg>
              )}
            </div>

            {/* Title */}
            {rawTitle ? (
              <h2 id="nTitle" dangerouslySetInnerHTML={{ __html: parsedTitleHtml }} />
            ) : (
              <h2 id="nTitle">{notice.title}</h2>
            )}

            {/* Description Text */}
            <p className="msg" id="nText">
              {notice.text || ''}
            </p>

            {/* Gold Hairline Divider */}
            <div className="divider" />

            {/* Luxury CTA Button */}
            <button
              className="btn"
              id="btnOk"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                close();
              }}
            >
              <span id="nBtn">{buttonText}</span>
              <svg viewBox="0 0 24 24">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>

            {/* Optional Stamp with glowing status dot */}
            {notice.stamp ? (
              <div className="stamp" id="nStampBox">
                <i />
                <span id="nStamp">{notice.stamp}</span>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </aside>
  );
};

export default NoticeBoard;
