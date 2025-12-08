import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const SmtpContext = createContext(null);

// Menyimpan status SMTP indikator (merah/hijau) secara global
export const SmtpProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [hasConfig, setHasConfig] = useState(false);
  const [loading, setLoading] = useState(false);

  const checkConfig = async () => {
    if (!isAuthenticated) {
      setHasConfig(false);
      return;
    }

    setLoading(true);
    try {
      const res = await api.get('/config/check');
      setHasConfig(Boolean(res.data?.hasConfig));
    } catch (err) {
      console.error(err);
      setHasConfig(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  return (
    <SmtpContext.Provider value={{ hasConfig, loading, checkConfig, setHasConfig }}>
      {children}
    </SmtpContext.Provider>
  );
};

export const useSmtp = () => useContext(SmtpContext);
