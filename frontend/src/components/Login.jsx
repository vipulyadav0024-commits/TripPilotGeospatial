import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Send, Mail, Lock, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem('token')) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed');
      }

      localStorage.setItem('token', data.token);
      const displayName = data.user?.name || data.user?.email?.split('@')[0];
      if (displayName) {
        localStorage.setItem('userName', displayName);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Unable to connect to the server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream-50 text-ink-900 flex flex-col justify-center items-center p-4 relative overflow-hidden">

      {/* Background Decorative Blur */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-brand-400/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-72 h-72 bg-lagoon-400/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Login Box */}
      <div className="w-full max-w-md bg-white border border-ink-900/10 rounded-[32px] p-8 sm:p-10 shadow-xl shadow-ink-900/10 relative">

        {/* Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="bg-ink-900 p-3 rounded-2xl shadow-lg shadow-ink-900/25 mb-4 -rotate-6">
            <Send className="h-7 w-7 text-sun-400" />
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink-900">Welcome back</h2>
          <p className="text-sm text-ink-900/55 mt-2">Sign in to access your itinerary board</p>
        </div>

        {/* Errors Display */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 text-sm mb-6 animate-shake">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-900/50 mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-ink-900/35" />
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-cream-50 border border-ink-900/15 rounded-xl py-3 pl-11 pr-4 text-sm text-ink-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition duration-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-900/50 mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-ink-900/35" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-cream-50 border border-ink-900/15 rounded-xl py-3 pl-11 pr-4 text-sm text-ink-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition duration-200"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3.5 px-6 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex justify-center items-center gap-2 mt-8 disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-brand-500/25"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Authenticating...
              </>
            ) : (
              <>
                Sign In <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center text-sm text-ink-900/55 mt-8">
          Don't have an account?{' '}
          <Link to="/register" className="text-brand-600 hover:text-brand-700 font-semibold transition">
            Create Account
          </Link>
        </div>

      </div>
    </div>
  );
}
