'use client';

import { useEffect } from 'react';
import { useGlobalToast } from '@/app/components/common/Toast';

export function ToastBridge() {
  const toast = useGlobalToast();

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail) return;
      const { message, type = 'info', duration = 4000 } = detail;
      toast.info(message, { duration });
    };

    window.addEventListener('show-toast', handler as EventListener);
    return () => window.removeEventListener('show-toast', handler as EventListener);
  }, [toast]);

  return null;
}
