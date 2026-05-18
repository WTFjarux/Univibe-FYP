// frontend/src/pages/admin/Login.jsx

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, Shield, ArrowRight, AlertCircle } from 'lucide-react';
import api from '../api/axios';
import useAuthStore from '../store/authStore';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setErrorCode('');
    setAttemptsLeft(null);

    // Client-side validation
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    // Email format validation
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/api/admin/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      });

      if (data.success) {
        // NEW: Store tokens and minimal admin data
        const { accessToken, refreshToken, admin } = data.data;
        
        // Store tokens securely
        login(admin, accessToken, refreshToken);
        
        // Redirect to dashboard
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      const response = err.response?.data;
      
      // Handle different error types
      if (err.response?.status === 429) {
        // Rate limited
        setError('Too many login attempts. Please try again later.');
        setErrorCode('RATE_LIMITED');
      } else if (response?.attemptsLeft !== undefined) {
        // Failed login with remaining attempts
        setError(`Invalid email or password. ${response.attemptsLeft} attempts remaining.`);
        setAttemptsLeft(response.attemptsLeft);
        setErrorCode('INVALID_CREDENTIALS');
      } else if (err.response?.status === 403) {
        // Email not verified
        setError(response?.message || 'Please verify your email before logging in.');
        setErrorCode('EMAIL_NOT_VERIFIED');
      } else {
        // Generic error (prevents user enumeration)
        setError('Invalid email or password');
        setErrorCode('INVALID_CREDENTIALS');
      }
    } finally {
      setLoading(false);
    }
  };

  const getErrorStyles = () => {
    switch (errorCode) {
      case 'RATE_LIMITED':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-200',
          icon: 'bg-orange-100',
          text: 'text-orange-600',
          iconColor: 'text-orange-500',
        };
      case 'EMAIL_NOT_VERIFIED':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          icon: 'bg-yellow-100',
          text: 'text-yellow-600',
          iconColor: 'text-yellow-500',
        };
      default:
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          icon: 'bg-red-100',
          text: 'text-red-600',
          iconColor: 'text-red-500',
        };
    }
  };

  const errorStyles = getErrorStyles();

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #faf9f6 0%, #e8e6e1 100%)' }}>
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12">
        <div className="max-w-md text-center">
          {/* Logo */}
          <div className="mb-8">
            <h1 className="text-6xl tracking-wider" style={{ color: '#1f2937', fontFamily: 'Sofia, serif' }}>
              UNIVIBE
            </h1>
            <div className="flex items-center justify-center gap-2 mt-4">
              <Shield className="w-5 h-5" style={{ color: '#8b5cf6' }} />
              <span className="text-lg" style={{ color: '#8b5cf6', fontFamily: 'Sofia Sans', fontWeight: 700 }}>
                ADMIN PANEL
              </span>
            </div>
          </div>

          {/* Slogan */}
          <p className="text-xl" style={{ color: '#4b5563', fontFamily: 'Sofia Sans', fontWeight: 700 }}>
            Your Campus, Your Community,
          </p>
          <p className="text-xl mb-8" style={{ color: '#4b5563', fontFamily: 'Sofia Sans', fontWeight: 700 }}>
            Your Control.
          </p>

          {/* Decorative dots */}
          <div className="flex justify-center gap-4 mt-12">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#8b5cf6', opacity: 0.3 }}></div>
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#8b5cf6', opacity: 0.5 }}></div>
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#8b5cf6', opacity: 0.7 }}></div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-4xl tracking-wider mb-2" style={{ color: '#1f2937', fontFamily: 'Sofia, serif' }}>
              UNIVIBE
            </h1>
            <div className="flex items-center justify-center gap-2">
              <Shield className="w-4 h-4" style={{ color: '#8b5cf6' }} />
              <span className="text-sm" style={{ color: '#8b5cf6', fontFamily: 'Sofia Sans', fontWeight: 600 }}>
                ADMIN PANEL
              </span>
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-3xl p-8" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            {/* Sign In Title */}
            <h2 className="text-2xl text-center mb-8" style={{ color: '#1f2937', fontFamily: 'Sofia Sans', fontWeight: 700 }}>
              SIGN IN
            </h2>

            {/* Error Message - Enhanced */}
            {error && (
              <div 
                className={`flex items-start gap-3 ${errorStyles.bg} border ${errorStyles.border} rounded-2xl px-4 py-3 mb-6`}
                role="alert"
              >
                <div className={`w-5 h-5 rounded-full ${errorStyles.icon} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <AlertCircle className={`w-3 h-3 ${errorStyles.iconColor}`} />
                </div>
                <div>
                  <p className={`${errorStyles.text} text-sm`} style={{ fontFamily: 'Sofia Sans', fontWeight: 500 }}>
                    {error}
                  </p>
                  {attemptsLeft !== null && attemptsLeft <= 2 && (
                    <p className="text-xs mt-1 text-gray-500" style={{ fontFamily: 'Sofia Sans' }}>
                      After {attemptsLeft} more failed attempts, your account will be temporarily locked.
                    </p>
                  )}
                  {errorCode === 'RATE_LIMITED' && (
                    <p className="text-xs mt-1 text-gray-500" style={{ fontFamily: 'Sofia Sans' }}>
                      Please wait 15 minutes before trying again.
                    </p>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Email Input */}
              <div className="relative mb-5">
                <div className="absolute left-5 top-1/2 -translate-y-1/2">
                  <Mail className="w-5 h-5" style={{ color: '#6b7280' }} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                    setAttemptsLeft(null);
                  }}
                  placeholder="Email"
                  disabled={loading}
                  autoComplete="email"
                  autoFocus
                  className="w-full pl-12 pr-5 py-4 bg-white border border-gray-200 rounded-3xl text-base outline-none transition-all duration-200"
                  style={{
                    color: '#1f2937',
                    fontFamily: 'Sofia Sans',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#8b5cf6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
                  }}
                />
              </div>

              {/* Password Input */}
              <div className="relative mb-5">
                <div className="absolute left-5 top-1/2 -translate-y-1/2">
                  <Lock className="w-5 h-5" style={{ color: '#6b7280' }} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                    setAttemptsLeft(null);
                  }}
                  placeholder="Password"
                  disabled={loading}
                  autoComplete="current-password"
                  className="w-full pl-12 pr-12 py-4 bg-white border border-gray-200 rounded-3xl text-base outline-none transition-all duration-200"
                  style={{
                    color: '#1f2937',
                    fontFamily: 'Sofia Sans',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#8b5cf6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 p-1"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" style={{ color: '#6b7280' }} />
                  ) : (
                    <Eye className="w-5 h-5" style={{ color: '#6b7280' }} />
                  )}
                </button>
              </div>

              {/* Forgot Password */}
              <div className="flex justify-end mb-8">
                <button
                  type="button"
                  className="text-sm hover:underline"
                  style={{ color: '#8b5cf6', fontFamily: 'Sofia Sans', fontWeight: 500 }}
                >
                  Forgot Password?
                </button>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-3xl text-white text-base flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-60 mb-8"
                style={{
                  backgroundColor: '#8b5cf6',
                  boxShadow: '0 4px 16px rgba(139, 92, 246, 0.3)',
                  fontFamily: 'Sofia Sans',
                  fontWeight: 600,
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.target.style.backgroundColor = '#7c3aed';
                    e.target.style.boxShadow = '0 6px 20px rgba(139, 92, 246, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading) {
                    e.target.style.backgroundColor = '#8b5cf6';
                    e.target.style.boxShadow = '0 4px 16px rgba(139, 92, 246, 0.3)';
                  }
                }}
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>SIGNING IN...</span>
                  </>
                ) : (
                  <>
                    SIGN IN
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 h-px bg-gray-200"></div>
                <span className="text-sm" style={{ color: '#6b7280', fontFamily: 'Sofia Sans', fontWeight: 500 }}>SECURE</span>
                <div className="flex-1 h-px bg-gray-200"></div>
              </div>

              {/* Security Notice */}
              <div className="text-center">
                <div className="flex items-center justify-center gap-2">
                  <Shield className="w-4 h-4" style={{ color: '#8b5cf6' }} />
                  <p className="text-xs" style={{ color: '#6b7280', fontFamily: 'Sofia Sans' }}>
                    Authorized personnel only. All access is logged.
                  </p>
                </div>
              </div>
            </form>
          </div>

          {/* Footer */}
          <p className="text-center text-xs mt-6" style={{ color: '#9ca3af', fontFamily: 'Sofia Sans' }}>
            © 2025 Univibe Admin Panel. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;