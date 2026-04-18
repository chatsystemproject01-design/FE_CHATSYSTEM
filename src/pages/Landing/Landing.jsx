import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Landing.css';
import logo from '../../assets/logo.png';

const Landing = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    useEffect(() => {
        if (user) {
            navigate('/chat');
        }
    }, [user, navigate]);

    return (
        <div className="page-center-wrapper">
            <div className="landing-card">
                <div className="landing-logo-section">
                    <img src={logo} alt="Nexus Logo" className="landing-logo-img" />
                </div>
                
                <div className="landing-text-section">
                    <h1 className="landing-title">HỆ THỐNG CHAT NỘI BỘ</h1>
                    <h2 className="landing-company">NEXUS TECH</h2>
                    <p className="landing-desc">
                        Nền tảng kết nối và cộng tác nội bộ an toàn dành cho doanh nghiệp.
                    </p>
                </div>

                <div className="landing-buttons">
                    <button 
                        className="btn-primary landing-btn" 
                        onClick={() => navigate('/login')}
                    >
                        Đăng Nhập
                    </button>
                    <button 
                        className="btn-secondary landing-btn" 
                        onClick={() => navigate('/register')}
                    >
                        Đăng Ký
                    </button>
                </div>

                <div className="landing-footer">
                   <span className="footer-copyright">© 2026 Nexus Tech Solution</span>
                </div>
            </div>
        </div>
    );
};

export default Landing;
