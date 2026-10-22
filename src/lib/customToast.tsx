import React from 'react';
import { showNotice, closeNotice, openNotice, showModal, NoticeOptions, NoticeType } from './notice';
import { toast as sonnerToast } from 'sonner';

export { showNotice, closeNotice, openNotice, showModal };
export type { NoticeOptions, NoticeType };
export { ModernTopToast } from '../components/ModernTopToast';
export type { ToastVariant } from '../components/ModernTopToast';

export interface ToastOptions {
  description?: string | React.ReactNode;
  icon?: React.ReactNode;
  badge?: string;
  category?: string;
  eyebrow?: string;
  button?: string;
  stamp?: string;
  duration?: number;
  autoClose?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  id?: string | number;
  position?: string;
  onClose?: () => void;
  [key: string]: any;
}

function normalizeToNotice(
  titleInput: any,
  type: NoticeType = 'info',
  optionsInput?: ToastOptions | string | React.ReactNode
): NoticeOptions {
  let title: string | React.ReactNode = '';
  let text: string | React.ReactNode = '';
  let opts: ToastOptions = {};

  if (typeof optionsInput === 'string' || React.isValidElement(optionsInput)) {
    text = optionsInput as any;
  } else if (optionsInput && typeof optionsInput === 'object') {
    opts = { ...optionsInput };
    if (opts.description) text = opts.description;
    if (opts.text) text = opts.text;
  }

  if (titleInput instanceof Error) {
    title = titleInput.message || 'An error occurred';
    type = 'error';
  } else if (titleInput && typeof titleInput === 'object' && !React.isValidElement(titleInput)) {
    if ('message' in titleInput) {
      title = String((titleInput as any).message);
    } else if ('title' in titleInput) {
      title = String((titleInput as any).title);
    } else {
      title = String(titleInput);
    }
    if ((titleInput as any).description && !text) {
      text = (titleInput as any).description;
    }
    if ((titleInput as any).text && !text) {
      text = (titleInput as any).text;
    }
    if ((titleInput as any).type) {
      type = (titleInput as any).type;
    }
    if ((titleInput as any).eyebrow && !opts.eyebrow) {
      opts.eyebrow = (titleInput as any).eyebrow;
    }
    if ((titleInput as any).button && !opts.button) {
      opts.button = (titleInput as any).button;
    }
    if ((titleInput as any).stamp && !opts.stamp) {
      opts.stamp = (titleInput as any).stamp;
    }
    if ((titleInput as any).autoClose && opts.autoClose === undefined) {
      opts.autoClose = (titleInput as any).autoClose;
    }
  } else {
    title = titleInput ?? '';
  }

  const eyebrow =
    opts.eyebrow ||
    opts.badge ||
    opts.category ||
    (type === 'success' ? 'All done' : type === 'error' ? 'Something went wrong' : 'Heads up');

  const button =
    opts.button ||
    opts.action?.label ||
    (type === 'error' ? 'Try again' : type === 'info' ? 'Got it' : 'Continue');

  const onClose = opts.action?.onClick || opts.onClose;
  const autoClose =
    opts.autoClose !== undefined
      ? opts.autoClose
      : opts.duration !== undefined
      ? opts.duration
      : (type === 'error' ? 5500 : 4500);

  return {
    type,
    eyebrow,
    title,
    text,
    button,
    stamp: opts.stamp,
    icon: opts.icon,
    onClose,
    autoClose,
  };
}

export function showModernToast(
  titleInput: any,
  variant: NoticeType = 'info',
  optionsInput?: ToastOptions | string | React.ReactNode
): string | number {
  const notice = normalizeToNotice(titleInput, variant, optionsInput);
  showNotice(notice);
  const optId =
    optionsInput &&
    typeof optionsInput === 'object' &&
    !React.isValidElement(optionsInput) &&
    'id' in optionsInput
      ? (optionsInput as any).id
      : undefined;
  return optId !== undefined ? optId : Date.now().toString();
}

const toastFn = (message: any, options?: ToastOptions | string): string | number => {
  return showModernToast(message, 'info', options);
};

export const toast = Object.assign(toastFn, {
  success: (message: any, options?: ToastOptions | string): string | number =>
    showModernToast(message, 'success', options),
  error: (message: any, options?: ToastOptions | string): string | number =>
    showModernToast(message, 'error', options),
  warning: (message: any, options?: ToastOptions | string): string | number =>
    showModernToast(message, 'error', options),
  info: (message: any, options?: ToastOptions | string): string | number =>
    showModernToast(message, 'info', options),
  achievement: (message: any, options?: ToastOptions | string): string | number => {
    const notice = normalizeToNotice(message, 'success', options);
    if (!notice.eyebrow || notice.eyebrow === 'All done') {
      notice.eyebrow = 'Milestone achieved';
    }
    if (!notice.button || notice.button === 'Continue') {
      notice.button = 'Continue';
    }
    showNotice(notice);
    return typeof options === 'object' && options !== null && options.id !== undefined
      ? options.id
      : Date.now().toString();
  },
  loading: (message: any, options?: ToastOptions | string): string | number => {
    return showModernToast(message, 'info', options);
  },
  promise: sonnerToast.promise,
  dismiss: (id?: any) => {
    closeNotice();
    try {
      sonnerToast.dismiss(id);
    } catch (_) {}
  },
  custom: (fn: any, opts?: any) => {
    return sonnerToast.custom(fn, opts);
  },
  message: (message: any, options?: ToastOptions | string) =>
    showModernToast(message, 'info', options),
});

export const showToast = toast;
export default toast;
