import { useEffect, useState } from 'react';

const useToast = (timeoutMs = 2600) => {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), timeoutMs);
    return () => clearTimeout(timer);
  }, [toast, timeoutMs]);

  const showToast = (message, type = 'info', action) => {
    if (!message) return;
    setToast({ message, type, action });
  };

  const clearToast = () => setToast(null);

  return { toast, showToast, clearToast };
};

export default useToast;
