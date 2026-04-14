import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Kiểm tra thông tin đăng nhập từ session storage
    const storedUser = sessionStorage.getItem('user');
    const token = sessionStorage.getItem('access_token');
    
    if (storedUser && token) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Lỗi parse user từ session:", e);
        sessionStorage.clear();
      }
    }
    setLoading(false);
  }, []);

  const login = (userData, token) => {
    // Lưu thông tin vào sessionStorage
    sessionStorage.setItem('user', JSON.stringify(userData));
    sessionStorage.setItem('access_token', token);
    
    // Lưu các trường quan trọng riêng lẻ nếu cần truy cập nhanh
    sessionStorage.setItem('userId', userData.userId);
    sessionStorage.setItem('email', userData.email);
    sessionStorage.setItem('role', userData.role);
    
    setUser(userData);
  };

  const logout = () => {
    sessionStorage.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
