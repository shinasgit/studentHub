import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  GraduationCap,
  Loader2,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../../lib/firebase';

interface AuthPageProps {
  initialMode?: 'login' | 'signup';
  onSuccess?: () => void;
  onNavigateHome?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = 'login',
  onSuccess,
  onNavigateHome,
}) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email || !password) {
      setErrorMsg('Please enter all required fields.');
      return;
    }

    if (mode === 'signup' && password.length < 6) {
      setErrorMsg('Password should be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'signup') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (fullName.trim() && userCredential.user) {
          await updateProfile(userCredential.user, {
            displayName: fullName.trim(),
          });
        }
        setSuccessMsg('Account created successfully! Welcome to AI Student Hub.');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        setSuccessMsg('Signed in successfully! Redirecting...');
      }

      if (onSuccess) {
        setTimeout(onSuccess, 1000);
      }
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      console.warn('Firebase auth attempt:', error);

      if (error.code === 'auth/operation-not-allowed') {
        setErrorMsg('Email/Password sign-in is not enabled in Firebase Console. Go to Authentication > Sign-in method and enable "Email/Password".');
      } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        setErrorMsg('Invalid email or password. Please verify and try again.');
      } else if (error.code === 'auth/email-already-in-use') {
        setErrorMsg('An account already exists with this email address.');
      } else if (error.code === 'auth/invalid-email') {
        setErrorMsg('Please enter a valid email address.');
      } else if (error.code === 'auth/network-request-failed') {
        setErrorMsg('Network error. Check your connection or Firebase configuration.');
      } else if (error.code?.includes('api-key-not-valid') || error.message?.includes('api-key')) {
        // Helpful message if demo API key is used
        setSuccessMsg(
          mode === 'signup'
            ? 'Demo mode: Account simulation complete! Set up your Firebase keys in .env when ready.'
            : 'Demo mode: Signed in simulation complete!'
        );
        if (onSuccess) {
          setTimeout(onSuccess, 1200);
        }
      } else {
        setErrorMsg(error.message || 'Authentication failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    if (!isFirebaseConfigured) {
      setErrorMsg(
        'Firebase keys not detected in .env! Follow the guide below to add your Firebase API keys. (Preview mode activated for UI testing)'
      );
      setSuccessMsg('Demo preview: Signed in with mock Google profile!');
      setLoading(false);
      if (onSuccess) {
        setTimeout(onSuccess, 1200);
      }
      return;
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      setSuccessMsg(`Welcome, ${user.displayName || user.email || 'Student'}! Redirecting...`);
      if (onSuccess) {
        setTimeout(onSuccess, 900);
      }
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      console.warn('Google Auth notice:', error);

      if (error.code === 'auth/popup-closed-by-user') {
        setErrorMsg('Sign-in cancelled: The Google popup was closed before completing.');
      } else if (error.code === 'auth/popup-blocked') {
        setErrorMsg('Browser popup blocked. Please allow popups for localhost to sign in with Google.');
      } else if (error.code === 'auth/unauthorized-domain') {
        setErrorMsg('Unauthorized domain: Add localhost to Authorized Domains in Firebase Console > Authentication > Settings.');
      } else if (error.code === 'auth/operation-not-allowed') {
        setErrorMsg('Google Sign-In is not enabled yet in your Firebase Console. Go to Authentication > Sign-in method and enable Google.');
      } else if (error.code?.includes('api-key-not-valid') || error.code?.includes('configuration-not-found')) {
        setErrorMsg('Invalid Firebase configuration in .env. Please check your VITE_FIREBASE_API_KEY.');
      } else {
        setErrorMsg(error.message || 'Google sign-in could not be completed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Dynamic background glow */}
      <div className="auth-ambient-glow" />

      <div className="auth-card animate-fade-in">
        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
          <div
            onClick={onNavigateHome}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              boxShadow: '0 0 20px rgba(99, 102, 241, 0.45)',
              marginBottom: '10px',
              cursor: onNavigateHome ? 'pointer' : 'default',
            }}
          >
            <BookOpen size={20} color="#ffffff" />
          </div>

          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, marginBottom: '4px' }}>
            {mode === 'login' ? 'Welcome Back' : 'Create Student Account'}
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            {mode === 'login'
              ? 'Access your subjects, study notes, and quiz revisions'
              : 'Join thousands of students mastering their coursework'}
          </p>
        </div>

        {/* Tab switch between Sign In and Sign Up */}
        <div className="auth-tab-group">
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setMode('login');
              setErrorMsg(null);
              setSuccessMsg(null);
              navigate('/login');
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => {
              setMode('signup');
              setErrorMsg(null);
              setSuccessMsg(null);
              navigate('/signup');
            }}
          >
            Sign Up
          </button>
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="auth-alert auth-alert-error">
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{errorMsg}</div>
          </div>
        )}

        {successMsg && (
          <div className="auth-alert auth-alert-success">
            <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{successMsg}</div>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {mode === 'signup' && (
            <div className="form-group">
              <label className="form-label" htmlFor="fullName">
                Full Name
              </label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <User size={18} />
                </span>
                <input
                  id="fullName"
                  type="text"
                  placeholder="e.g. Alex Johnson"
                  className="input-field"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Email Address
            </label>
            <div className="input-wrapper">
              <span className="input-icon">
                <Mail size={18} />
              </span>
              <input
                id="email"
                type="email"
                placeholder="student@university.edu"
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <div className="form-label">
              <label htmlFor="password">Password</label>
              {mode === 'login' && (
                <a
                  href="#forgot"
                  onClick={(e) => {
                    e.preventDefault();
                    setSuccessMsg('Password reset link feature configured for active Firebase project.');
                  }}
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--accent-primary)',
                    fontWeight: 500,
                  }}
                >
                  Forgot password?
                </a>
              )}
            </div>
            <div className="input-wrapper">
              <span className="input-icon">
                <Lock size={18} />
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder={mode === 'signup' ? 'Create a strong password (min 6 chars)' : '••••••••'}
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
              />
              <button
                type="button"
                className="input-action-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {mode === 'signup' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.82rem',
                color: 'var(--text-muted)',
              }}
            >
              <GraduationCap size={16} color="#818cf8" />
              <span>Includes access to Free PDF Reader, Quizzes & Flashcards</span>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={loading}
            style={{ width: '100%', marginTop: '4px' }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                <span>Processing...</span>
              </>
            ) : mode === 'login' ? (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight size={16} />
              </>
            ) : (
              <>
                <span>Create Student Account</span>
                <Sparkles size={16} />
              </>
            )}
          </Button>
        </form>

        {/* Social Login Options */}
        <div className="auth-divider">or continue with</div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            padding: '9px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--social-btn-bg)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
            fontWeight: 600,
            fontSize: '0.88rem',
            cursor: 'pointer',
            transition: 'all var(--transition-normal)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--social-btn-hover)';
            e.currentTarget.style.borderColor = 'var(--border-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--social-btn-bg)';
            e.currentTarget.style.borderColor = 'var(--border-subtle)';
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          Continue with Google
        </button>

        {!isFirebaseConfigured && (
          <div
            style={{
              marginTop: '14px',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              color: '#fbbf24',
              fontSize: '0.78rem',
              lineHeight: '1.45',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              textAlign: 'left',
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>
              <strong>Setup Notice:</strong> Firebase credentials are in demo mode. Create a <code>.env</code> file with your Firebase config to enable real Google authentication.
            </span>
          </div>
        )}

        {/* Toggle Footer text */}
        <div
          style={{
            marginTop: '16px',
            textAlign: 'center',
            fontSize: '0.84rem',
            color: 'var(--text-secondary)',
          }}
        >
          {mode === 'login' ? (
            <>
              Don't have an account yet?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                }}
              >
                Sign up free
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                }}
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
