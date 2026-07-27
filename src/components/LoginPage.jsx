import { useState } from 'react';
import { api } from '../lib/api';
import { LogIn, AlertCircle } from 'lucide-react';

const DEMO_EMAIL = 'admin@admin.com';
const DEMO_PASS = 'admin';

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please fill in all fields'); return; }
    setBusy(true);
    try {
      const { token, user } = await api.login(email, password);
      onLogin(user, token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center mx-auto mb-4">
            <span className="text-lg font-bold text-amber-500">DI</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">DoneIt Task Portal</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to your workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="you@company.com"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="··········"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full btn-amber flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy ? (
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            {busy ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
