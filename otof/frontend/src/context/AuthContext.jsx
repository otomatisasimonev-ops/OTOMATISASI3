import { createContext, useContext, useState, useEffect } from 'react';
import api, { setAccessToken, clearAccessToken } from '../services/api';

const AuthContext = createContext(null);

// Penyimpanan state auth + helper login/logout
export const AuthProvider = ({ children }) => {
  // HANYA simpan minimal user info (id, username, role) - TIDAK termasuk token
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Restore session saat pertama kali mount
  useEffect(() => {
    const restoreSession = async () => {
      const savedUser = localStorage.getItem('user');
      
      // Jika tidak ada user tersimpan, skip restore
      if (!savedUser) {
        setIsInitializing(false);
        return;
      }

      try {
        // Coba refresh token untuk mendapatkan access token baru
        const { data } = await api.post('/auth/refresh');
        setAccessToken(data.accessToken);
        // User sudah di-set dari localStorage di initial state
      } catch (err) {
        // Refresh token expired/invalid, clear user data
        console.warn('Session restore gagal, silakan login ulang');
        setUser(null);
        localStorage.removeItem('user');
        clearAccessToken();
      } finally {
        setIsInitializing(false);
      }
    };

    restoreSession();
  }, []);

  const login = async (username, password) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { username, password });
      
      // Simpan access token di memory (BUKAN di localStorage)
      setAccessToken(response.data.accessToken);
      
      // Simpan minimal user info ke localStorage (tanpa token sensitif)
      const userInfo = {
        id: response.data.user.id,
        username: response.data.user.username,
        role: response.data.user.role,
      };
      setUser(userInfo);
      localStorage.setItem('user', JSON.stringify(userInfo));
      
      return { success: true };
    } catch (err) {
      return { 
        success: false, 
        message: err.response?.data?.message || 'Login gagal' 
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      // Panggil logout endpoint untuk clear refresh token cookie
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Clear access token dari memory
      clearAccessToken();
      // Clear user info dari state dan localStorage
      setUser(null);
      localStorage.removeItem('user');
      setLoading(false);
    }
  };

  // Show loading screen saat initialize session
  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: Boolean(user),
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
