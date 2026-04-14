import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import './Register.css'

function Register() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    password: '',
    phone: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'
      const response = await axios.post(`${API_URL}/auth/register`, formData)
      
      if (response.status === 201 || response.status === 200) {
        setSuccess('Đăng ký tài khoản thành công!')
        setTimeout(() => {
          navigate('/')
        }, 2000)
      }
    } catch (err) {
      setError(
        err.response?.data?.message || 
        'Đã xảy ra lỗi trong quá trình đăng ký. Vui lòng thử lại.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-center-wrapper">
      <div className="register-container">
        <div className="register-card">
          <h2>Đăng ký tài khoản</h2>
          
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Họ và tên</label>
              <input
                type="text"
                name="fullName"
                placeholder="Nhập họ và tên"
                value={formData.fullName}
                onChange={handleChange}
                required
              />
            </div>
            
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
              <label>Số điện thoại</label>
              <input
                type="tel"
                name="phone"
                placeholder="Nhập số điện thoại"
                value={formData.phone}
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
              {loading ? 'Đang xử lý...' : 'Đăng ký ngay'}
            </button>
          </form>
          
          <span className="back-link" onClick={() => navigate('/')}>
            ← Quay lại trang chủ
          </span>
        </div>
      </div>
    </div>
  )
}

export default Register
