import React from 'react';

export type NoticeType = 'success' | 'error' | 'info';

export interface NoticeOptions {
  type?: NoticeType;
  eyebrow?: string;
  title: string | React.ReactNode;
  text?: string | React.ReactNode;
  button?: string;
  stamp?: string;
  icon?: React.ReactNode;
  onClose?: () => void;
  autoClose?: number;
}

type NoticeListener = (notice: NoticeOptions | null) => void;

let currentListener: NoticeListener | null = null;
let pendingNotice: NoticeOptions | null = null;

export function registerNoticeListener(listener: NoticeListener) {
  currentListener = listener;
  if (pendingNotice) {
    listener(pendingNotice);
    pendingNotice = null;
  }
  return () => {
    if (currentListener === listener) {
      currentListener = null;
    }
  };
}

export function showNotice(input: NoticeOptions | string) {
  const notice: NoticeOptions = typeof input === 'string'
    ? { title: input, type: 'info' }
    : input;

  if (currentListener) {
    currentListener(notice);
  } else {
    pendingNotice = notice;
  }
}

export function closeNotice() {
  if (currentListener) {
    currentListener(null);
  }
}

export const openNotice = showNotice;
export const showModal = showNotice;
