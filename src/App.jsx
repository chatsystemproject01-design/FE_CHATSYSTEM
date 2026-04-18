import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import axios from 'axios'
import { AuthProvider } from './context/AuthContext'
import Home from './pages/Home/Home'
import Landing from './pages/Landing/Landing'
import Register from './pages/Register/Register'
import Login from './pages/Login/Login'
import ForgotPassword from './pages/ForgotPassword/ForgotPassword'

function App() {
  const [isMaintenance, setIsMaintenance] = useState(false)

  useEffect(() => {
    // Cài đặt Interceptor bắt các lỗi 503 từ Backend
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 503) {
          setIsMaintenance(true)
        }
        return Promise.reject(error)
      }
    )
    return () => {
      axios.interceptors.response.eject(interceptor)
    }
  }, [])

  if (isMaintenance) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        <h1 style={{ color: '#1e293b', marginBottom: '0.5rem' }}>Hệ thống đang bảo trì</h1>
        <p style={{ color: '#64748b', fontSize: '1.2rem', textAlign: 'center', maxWidth: '400px' }}>Hiện tại máy chủ đang được nâng cấp hoặc bảo dưỡng. Vui lòng quay lại sau ít phút để sử dụng bạn nhé.</p>
        <button onClick={() => window.location.reload()} style={{ marginTop: '2rem', padding: '0.75rem 1.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Tải lại trang</button>
      </div>
    )
  }

  return (
    <AuthProvider>
      <Router>
        <div className="app-container">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/chat" element={<Home />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  )
}


export default App
