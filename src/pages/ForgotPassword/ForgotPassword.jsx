import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import './ForgotPassword.css'

function ForgotPassword() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1: Email, 2: OTP + New Password
  const [formData, setFormData] = useState({
    email: '',
    otpCode: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleRequestOtp = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'
      await axios.post(`${API_URL}/auth/forgot-password`, { email: formData.email })
      setStep(2)
    } catch (err) {
      setError(
        err.response?.data?.message || 
        'Email không tồn tại hoặc đã xảy ra lỗi. Vui lòng thử lại.'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (formData.newPassword !== formData.confirmPassword) {
      return setError('Mật khẩu xác nhận không khớp.')
    }
    setError('')
    setLoading(true)

    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'
      const response = await axios.post(`${API_URL}/auth/reset-password`, {
        email: formData.email,
        newPassword: formData.newPassword,
        otpCode: formData.otpCode
      })
      
      if (response.status === 200) {
        setSuccess('Đặt lại mật khẩu thành công! Đang chuyển về trang đăng nhập...')
        setTimeout(() => navigate('/login'), 2500)
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

  return (
    <div className="page-center-wrapper">
      <div className="forgot-password-container">
        <div className="forgot-card">
          <span className="back-link" onClick={() => (step === 1 ? navigate('/') : setStep(1))}>
            {step === 1 ? '← Quay lại' : '← Quay lại nhập email'}
          </span>
          <h2>{step === 1 ? 'Quên mật khẩu' : 'Đặt lại mật khẩu'}</h2>
          <p className="description">
            {step === 1 
              ? 'Nhập email của bạn để nhận mã xác thực đặt lại mật khẩu.'
              : `Nhập mã xác thực đã gửi đến ${formData.email} và mật khẩu mới của bạn.`
            }
          </p>
          
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          {step === 1 ? (
            <form onSubmit={handleRequestOtp}>
              <div className="form-group">
                <label>Email khôi phục</label>
                <input
                  type="email"
                  name="email"
                  placeholder="example@gmail.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  autoFocus
                />
              </div>
              
              <button type="submit" className="btn-primary submit-btn" disabled={loading}>
                {loading ? 'Đang gửi...' : 'Gửi mã xác thực'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label>Mã OTP</label>
                <input
                  type="text"
                  name="otpCode"
                  placeholder="Nhập mã 6 chữ số"
                  value={formData.otpCode}
                  onChange={handleChange}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Mật khẩu mới</label>
                <input
                  type="password"
                  name="newPassword"
                  placeholder="••••••••"
                  value={formData.newPassword}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Xác nhận mật khẩu</label>
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <button type="submit" className="btn-primary submit-btn" disabled={loading}>
                {loading ? 'Đang xử lý...' : 'Đổi mật khẩu ngay'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword
