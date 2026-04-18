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

  // Forgot Password States
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotStep, setForgotStep] = useState(1) // 1: Email, 2: Reset
  const [forgotEmail, setForgotEmail] = useState('')
  const [resetData, setResetData] = useState({ otpCode: '', newPassword: '', confirmPassword: '' })
  const [forgotError, setForgotError] = useState('')
  const [forgotSuccess, setForgotSuccess] = useState('')

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
        navigate('/chat')
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

  const handleForgotSubmit = async (e) => {
    e.preventDefault()
    setForgotError('')
    setLoading(true)
    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'
      await axios.post(`${API_URL}/auth/forgot-password`, { email: forgotEmail })
      setForgotStep(2)
    } catch (err) {
      setForgotError(err.response?.data?.message || 'Email không tồn tại.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetSubmit = async (e) => {
    e.preventDefault()
    if (resetData.newPassword !== resetData.confirmPassword) {
      return setForgotError('Mật khẩu xác nhận không khớp.')
    }
    setForgotError('')
    setLoading(true)
    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'
      await axios.post(`${API_URL}/auth/reset-password`, {
        email: forgotEmail,
        otpCode: resetData.otpCode,
        newPassword: resetData.newPassword
      })
      setForgotSuccess('Đổi mật khẩu thành công! Hãy đăng nhập lại.')
      setTimeout(() => {
        setShowForgotModal(false)
        setForgotStep(1)
        setForgotSuccess('')
      }, 2000)
    } catch (err) {
      setForgotError(err.response?.data?.message || 'OTP sai hoặc hết hạn.')
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
              <div style={{ display: 'flex', gap: '15px' }}>
                <span className="link-item" onClick={() => setShowForgotModal(true)}>
                  Quên mật khẩu?
                </span>
                <span className="link-item" onClick={() => navigate('/register')}>
                  Đăng ký
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {showForgotModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <button className="modal-close" onClick={() => setShowForgotModal(false)}>×</button>
            <h3>{forgotStep === 1 ? 'Khôi phục mật khẩu' : 'Đặt lại mật khẩu'}</h3>
            
            {forgotError && <div className="error-message">{forgotError}</div>}
            {forgotSuccess && <div className="success-message-simple">{forgotSuccess}</div>}

            {forgotStep === 1 ? (
              <form onSubmit={handleForgotSubmit}>
                <p className="modal-desc">Nhập email của bạn để nhận mã xác thực.</p>
                <div className="form-group">
                  <label>Email khôi phục</label>
                  <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="name@company.com" required />
                </div>
                <button type="submit" className="btn-primary submit-btn" disabled={loading}>
                  {loading ? 'Đang gửi...' : 'Gửi mã xác thực'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetSubmit}>
                <p className="modal-desc">Nhập mã OTP đã gửi đến <b>{forgotEmail}</b> và mật khẩu mới.</p>
                <div className="form-group">
                  <label>Mã OTP</label>
                  <input type="text" value={resetData.otpCode} onChange={(e) => setResetData({...resetData, otpCode: e.target.value})} placeholder="123456" required />
                </div>
                <div className="form-group">
                  <label>Mật khẩu mới</label>
                  <input type="password" value={resetData.newPassword} onChange={(e) => setResetData({...resetData, newPassword: e.target.value})} placeholder="••••••••" required />
                </div>
                <div className="form-group">
                  <label>Xác nhận mật khẩu</label>
                  <input type="password" value={resetData.confirmPassword} onChange={(e) => setResetData({...resetData, confirmPassword: e.target.value})} placeholder="••••••••" required />
                </div>
                <button type="submit" className="btn-primary submit-btn" disabled={loading}>
                  {loading ? 'Đang xử lý...' : 'Xác nhận đổi mật khẩu'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Login
