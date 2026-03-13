import { useState } from 'react';
import { Box, Flex, Text, Button, IconButton, Tooltip } from '@radix-ui/themes';
import { SunIcon, MoonIcon } from '@radix-ui/react-icons';
import { useThemeMode } from './ThemeContext';

const API_BASE = '/api';

export default function Login({ onLogin }) {
  const { mode, toggle } = useThemeMode();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed.');
        setLoading(false);
        return;
      }

      localStorage.setItem('crc_token', data.token);
      localStorage.setItem('crc_user', JSON.stringify(data.user));
      onLogin(data.user, data.token);
    } catch {
      setError('Network error. Is the server running?');
    }
    setLoading(false);
  };

  const isDark = mode === 'dark';

  return (
    <Box style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: isDark
        ? 'linear-gradient(135deg, #0f0f17 0%, #1a1a2e 50%, #16162a 100%)'
        : 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 50%, #ddd6fe 100%)',
    }}>
      {/* Theme toggle */}
      <Box style={{ position: 'fixed', top: 20, right: 20 }}>
        <Tooltip content={isDark ? 'Light mode' : 'Dark mode'}>
          <IconButton variant="ghost" size="2" color="gray" onClick={toggle} style={{ borderRadius: 10 }}>
            {isDark ? <SunIcon /> : <MoonIcon />}
          </IconButton>
        </Tooltip>
      </Box>

      <Box style={{
        width: '100%',
        maxWidth: 420,
        padding: '48px 40px',
        boxShadow: isDark
          ? '0 25px 50px -12px rgba(0,0,0,0.5)'
          : '0 25px 50px -12px rgba(0,0,0,0.12), 0 0 0 1px rgba(124,58,237,0.05)',
        borderRadius: 20,
        background: isDark ? '#1a1a26' : '#fff',
        border: isDark ? '1px solid #2a2a3a' : 'none',
      }}>
        <form onSubmit={handleSubmit}>
          <Flex direction="column" gap="5" align="center">
            {/* Logo */}
            <img
              src="/image.png"
              alt="HyperVerge"
              style={{
                width: 48,
                height: 48,
                objectFit: 'contain',
                filter: isDark ? 'none' : 'invert(1)',
              }}
            />

            <Flex direction="column" align="center" gap="1">
              <Text size="6" weight="bold" style={{ color: 'var(--text-heading)', letterSpacing: '-0.02em' }}>
                CRC Batch Processor
              </Text>
              <Text size="2" style={{ color: 'var(--text-muted)' }}>
                Criminal Risk Check Portal
              </Text>
            </Flex>

            <Flex direction="column" gap="1" style={{ width: '100%' }}>
              <Text size="2" weight="medium" style={{ color: 'var(--text-muted)' }}>Email</Text>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoFocus
                className="text-input"
                style={{ width: '100%', padding: '12px 16px', fontSize: 15, borderRadius: 12 }}
              />
            </Flex>

            <Flex direction="column" gap="1" style={{ width: '100%' }}>
              <Text size="2" weight="medium" style={{ color: 'var(--text-muted)' }}>Password</Text>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                className="text-input"
                style={{ width: '100%', padding: '12px 16px', fontSize: 15, borderRadius: 12 }}
              />
            </Flex>

            {error && (
              <Box style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                background: isDark ? 'rgba(220,38,38,0.1)' : '#fef2f2',
                border: isDark ? '1px solid rgba(220,38,38,0.2)' : '1px solid #fecaca',
              }}>
                <Text size="2" style={{ color: '#dc2626' }}>{error}</Text>
              </Box>
            )}

            <Button
              type="submit" size="3" disabled={loading}
              style={{
                width: '100%', height: 48, borderRadius: 12,
                fontSize: 15, fontWeight: 600,
                cursor: loading ? 'wait' : 'pointer',
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </Flex>
        </form>
      </Box>
    </Box>
  );
}
