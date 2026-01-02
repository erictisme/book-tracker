import { useState } from 'react';
import { BookOpen, Mail, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useAuth } from '../../contexts/AuthContext';

export function AuthPage() {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState('');

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

        {emailSent ? (
          <div className="bg-muted p-4 rounded-lg text-center space-y-2">
            <Mail className="h-8 w-8 mx-auto text-primary" />
            <p className="font-medium">Check your email</p>
            <p className="text-sm text-muted-foreground">
              We sent a login link to {email}
            </p>
            <p className="text-xs text-muted-foreground">
              Don't see it? Check your spam/junk folder
            </p>
            <Button
              variant="link"
              onClick={() => setEmailSent(false)}
              className="text-sm"
            >
              Use a different email
            </Button>
          </div>
        ) : (
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
          </form>
        )}

        <p className="text-xs text-center text-muted-foreground">
          By signing in, you agree to our terms of service
        </p>
      </div>
    </div>
  );
}
