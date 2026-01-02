import { useState } from 'react';
import { BookOpen, Mail, Loader2, KeyRound } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useAuth } from '../../contexts/AuthContext';

type AuthMode = 'signin' | 'signup' | 'magic' | 'forgot';

export function AuthPage() {
  const { signInWithEmail, signInWithPassword, signUpWithPassword, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<AuthMode>('signin');

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    setError('');

    const { error } = await signInWithEmail(email);

    if (error) {
      setError(error.message);
    } else {
      setEmailSent(true);
    }

    setIsLoading(false);
  };

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    setError('');

    if (mode === 'signup') {
      const { error } = await signUpWithPassword(email, password);
      if (error) {
        setError(error.message);
      } else {
        // Auto sign in after signup
        const { error: signInError } = await signInWithPassword(email, password);
        if (signInError) {
          setError('Account created! Please sign in.');
          setMode('signin');
        }
      }
    } else {
      const { error } = await signInWithPassword(email, password);
      if (error) {
        setError(error.message);
      }
    }

    setIsLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    setError('');

    const { error } = await resetPassword(email);

    if (error) {
      setError(error.message);
    } else {
      setResetSent(true);
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <BookOpen className="h-12 w-12" />
          <h1 className="text-2xl font-bold">Book Tracker</h1>
          <p className="text-muted-foreground text-center">
            Track your reading, see your stats
          </p>
        </div>

        {emailSent || resetSent ? (
          <div className="bg-muted p-4 rounded-lg text-center space-y-2">
            <Mail className="h-8 w-8 mx-auto text-primary" />
            <p className="font-medium">Check your email</p>
            <p className="text-sm text-muted-foreground">
              {resetSent
                ? `We sent a password reset link to ${email}`
                : `We sent a login link to ${email}`
              }
            </p>
            <p className="text-xs text-muted-foreground">
              Don't see it? Check your spam/junk folder
            </p>
            <Button
              variant="link"
              onClick={() => { setEmailSent(false); setResetSent(false); setMode('signin'); }}
              className="text-sm"
            >
              Back to sign in
            </Button>
          </div>
        ) : mode === 'forgot' ? (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Send reset link
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-sm"
              onClick={() => { setMode('signin'); setError(''); }}
            >
              Back to sign in
            </Button>
          </form>
        ) : mode === 'magic' ? (
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Send magic link
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-sm"
              onClick={() => { setMode('signin'); setError(''); }}
            >
              Use password instead
            </Button>
          </form>
        ) : (
          <form onSubmit={handlePasswordAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                minLength={6}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4 mr-2" />
              )}
              {mode === 'signup' ? 'Create account' : 'Sign in'}
            </Button>

            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="link"
                  className="p-0 h-auto"
                  onClick={() => {
                    setMode(mode === 'signin' ? 'signup' : 'signin');
                    setError('');
                  }}
                >
                  {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="p-0 h-auto"
                  onClick={() => { setMode('magic'); setError(''); }}
                >
                  Use magic link
                </Button>
              </div>
              {mode === 'signin' && (
                <Button
                  type="button"
                  variant="link"
                  className="p-0 h-auto text-muted-foreground"
                  onClick={() => { setMode('forgot'); setError(''); }}
                >
                  Forgot password?
                </Button>
              )}
            </div>
          </form>
        )}

        <p className="text-xs text-center text-muted-foreground">
          By signing in, you agree to our terms of service
        </p>
      </div>
    </div>
  );
}
