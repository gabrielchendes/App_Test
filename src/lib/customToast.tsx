import React from 'react';
import { toast as sonnerToast } from 'sonner';
import { ModernTopToast, ToastVariant } from '../components/ModernTopToast';

export interface ToastOptions {
  description?: string | React.ReactNode;
  icon?: React.ReactNode;
  badge?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  id?: string | number;
  position?: string;
  [key: string]: any;
}

function normalizeTitleAndOptions(
  input: any,
  options?: ToastOptions | string | React.ReactNode
): { title: React.ReactNode; opts: ToastOptions } {
  let title: React.ReactNode = '';
  let opts: ToastOptions = {};

  if (typeof options === 'string' || React.isValidElement(options)) {
    opts = { description: options };
  } else if (options && typeof options === 'object') {
    opts = { ...options };
  }

  if (input instanceof Error) {
    title = input.message || 'An error occurred';
  } else if (input && typeof input === 'object' && !React.isValidElement(input)) {
    if ('message' in input) {
      title = String((input as any).message);
    } else if ('title' in input) {
      title = String((input as any).title);
    } else {
      title = String(input);
    }
    if ((input as any).description && !opts.description) {
      opts.description = (input as any).description;
    }
  } else {
    title = input ?? '';
  }

  return { title, opts };
}

export function showModernToast(
  titleInput: any,
  variant: ToastVariant = 'default',
  optionsInput?: ToastOptions | string | React.ReactNode
) {
  const { title, opts } = normalizeTitleAndOptions(titleInput, optionsInput);
  const duration = opts?.duration || 4000;

  return sonnerToast.custom(
    (id) => (
      <ModernTopToast
        id={id}
        title={title}
        description={opts?.description}
        variant={variant}
        icon={opts?.icon}
        action={opts?.action}
      />
    ),
    { duration, id: opts?.id }
  );
}

const toastFn = (message: any, options?: ToastOptions | string) => {
  return showModernToast(message, 'default', options);
};

export const toast = Object.assign(toastFn, {
  success: (message: any, options?: ToastOptions | string) =>
    showModernToast(message, 'success', options),
  error: (message: any, options?: ToastOptions | string) =>
    showModernToast(message, 'error', options),
  warning: (message: any, options?: ToastOptions | string) =>
    showModernToast(message, 'warning', options),
  info: (message: any, options?: ToastOptions | string) =>
    showModernToast(message, 'info', options),
  achievement: (message: any, options?: ToastOptions | string) =>
    showModernToast(message, 'achievement', options),
  loading: (message: any, options?: ToastOptions | string) => {
    const { opts } = normalizeTitleAndOptions(message, options);
    return showModernToast(message, 'loading', { ...opts, duration: opts.duration || 15000 });
  },
  promise: sonnerToast.promise,
  dismiss: sonnerToast.dismiss,
  custom: sonnerToast.custom,
  message: (message: any, options?: ToastOptions | string) =>
    showModernToast(message, 'default', options),
});

export const showToast = toast;
export default toast;
