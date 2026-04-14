import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../../context/AuthContext'
import './Login.css'

function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const [step, setStep] = useState(1) // 1: Login, 2: OTP
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [otpCode, setOtpCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)

  // Xử lý đếm ngược 60s cho nút gửi lại mã
  React.useEffect(() => {
    let timer
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1)
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [countdown])

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'
      const response = await axios.post(`${API_URL}/auth/login/step1`, formData)
      
      if (response.status === 200) {
        setStep(2)
      }
    } catch (err) {
      setError(
        err.response?.data?.message || 
        'Email hoặc mật khẩu không chính xác. Vui lòng thử lại.'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleOtpSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'
      const response = await axios.post(`${API_URL}/auth/login/verify-2fa`, {
        email: formData.email,
        otpCode: otpCode,
      })
      
      if (response.status === 200) {
        const { user, access_token } = response.data.data
        login(user, access_token)
        navigate('/')
      }
    } catch (err) {
      setError(
        err.response?.data?.message || 
        'Mã OTP không chính xác hoặc đã hết hạn.'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleResendOtp = async () => {
    if (countdown > 0) return
    setError('')
    setLoading(true)

    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'
      // Call endpoint /api/v1/auth/resend-otp
      await axios.post(`${API_URL}/auth/resend-otp`, {
        email: formData.email,
      })
      setCountdown(60) // Start 1 minute countdown
    } catch (err) {
      setError(
        err.response?.data?.message || 
        'Không thể gửi lại mã lúc này. Vui lòng thử lại sau.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-center-wrapper">
      <div className="login-container">
        <div className="login-card">
          <h2>{step === 1 ? 'Đăng nhập' : 'Xác thực 2FA'}</h2>
          
          {error && <div className="error-message">{error}</div>}

          {step === 1 ? (
            <form onSubmit={handleLoginSubmit}>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  placeholder="example@gmail.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Mật khẩu</label>
                <input
                  type="password"
                  name="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <button 
                type="submit" 
                className="btn-primary submit-btn"
                disabled={loading}
              >
                {loading ? 'Đang xử lý...' : 'Đăng nhập'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit}>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem', textAlign: 'left' }}>
                Một mã xác thực đã được gửi đến <strong>{formData.email}</strong>. Vui lòng nhập mã bên dưới.
              </p>
              <div className="form-group">
                <label>Mã OTP</label>
                <input
                  type="text"
                  name="otpCode"
                  placeholder="Nhập mã 6 chữ số"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              
              <button 
                type="submit" 
                className="btn-primary submit-btn"
                disabled={loading}
              >
                {loading ? 'Đang xác thực...' : 'Xác thực ngay'}
              </button>
              
              <div className="resend-container">
                <button 
                  type="button" 
                  className="btn-ghost resend-btn" 
                  onClick={handleResendOtp}
                  disabled={loading || countdown > 0}
                >
                  {countdown > 0 ? `Gửi lại mã (${countdown}s)` : 'Gửi lại mã OTP'}
                </button>
              </div>

              <span className="link-item" onClick={() => setStep(1)} style={{ fontSize: '0.9rem', marginTop: '1rem', display: 'block' }}>
                ← Quay lại đăng nhập
              </span>
            </form>
          )}
          
          {step === 1 && (
            <div className="footer-links">
              <span className="link-item" onClick={() => navigate('/')}>
                ← Trang chủ
              </span>
              <span className="link-item" onClick={() => navigate('/register')}>
                Chưa có tài khoản? Đăng ký
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Login
