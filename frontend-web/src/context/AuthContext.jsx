import { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('kq_token') || null);
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('kq_user');
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  });

  useEffect(() => {
    if (token) {
      localStorage.setItem('kq_token', token);
    } else {
      localStorage.removeItem('kq_token');
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('kq_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('kq_user');
    }
  }, [user]);

  const login = (newToken, userPayload) => {
    setToken(newToken);
    if (userPayload) setUser(userPayload);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('kq_token');
    localStorage.removeItem('kq_user');
  };

  const hasRole = (...allowedRoles) => {
    if (!user || !user.role) return false;
    const rolesArray = allowedRoles.flat();
    return rolesArray.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        role: user?.role || null,
        isAuthenticated: Boolean(token),
        login,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
