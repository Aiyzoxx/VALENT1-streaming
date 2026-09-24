import React, { useState } from 'react';
import { IoEyeOutline, IoEyeOffOutline } from 'react-icons/io5';
import { useAuth } from '../../shared/hooks/useAuth';

export const MobileAuthView: React.FC = () => {
  const { login, register, error, clearError } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const switchMode = (m: 'login' | 'register') => {
    if (m === mode) return;
    clearError();
    setMode(m);
  };

  const canSubmit =
    email.trim().length > 3 &&
    email.includes('@') &&
    password.length >= 8 &&
    !busy;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
    } catch {
      /* Handled by AuthContext */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 20px) + 24px)',
        paddingBottom: 120,
        paddingLeft: 22,
        paddingRight: 22,
        width: '100%',
        minHeight: '100vh',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <span
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: '#FFFFFF',
            letterSpacing: -0.3,
          }}
        >
          Mon{' '}
        </span>
        <span
          style={{
            fontSize: 24,
            fontWeight: 400,
            color: '#FFFFFF',
            letterSpacing: -0.3,
          }}
        >
          Compte
        </span>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: '#7C8394',
            marginTop: 4,
          }}
        >
          Connecte-toi pour synchroniser favoris et historique.
        </div>
      </div>

      {/* Switch Connexion / Inscription */}
      <div
        style={{
          display: 'flex',
          backgroundColor: '#191C24',
          borderRadius: 18,
          padding: 4,
          marginBottom: 24,
          border: '1px solid #262B36',
        }}
      >
        <button
          onClick={() => switchMode('login')}
          style={{
            flex: 1,
            padding: '10px 0',
            textAlign: 'center',
            fontSize: 14,
            fontWeight: mode === 'login' ? 700 : 500,
            color: mode === 'login' ? '#FFFFFF' : '#7C8394',
            backgroundColor: mode === 'login' ? '#2B303C' : 'transparent',
            borderRadius: 14,
            transition: 'all 0.15s ease',
          }}
        >
          Connexion
        </button>
        <button
          onClick={() => switchMode('register')}
          style={{
            flex: 1,
            padding: '10px 0',
            textAlign: 'center',
            fontSize: 14,
            fontWeight: mode === 'register' ? 700 : 500,
            color: mode === 'register' ? '#FFFFFF' : '#7C8394',
            backgroundColor: mode === 'register' ? '#2B303C' : 'transparent',
            borderRadius: 14,
            transition: 'all 0.15s ease',
          }}
        >
          Inscription
        </button>
      </div>

      {/* Error alert */}
      {error && (
        <div
          style={{
            backgroundColor: 'rgba(229, 9, 20, 0.15)',
            border: '1px solid rgba(229, 9, 20, 0.4)',
            borderRadius: 14,
            padding: '12px 16px',
            color: '#FFFFFF',
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {mode === 'register' && (
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9EA4B3', marginBottom: 6 }}>
              Prénom ou pseudo
            </label>
            <input
              type="text"
              placeholder="Daizy"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                height: 50,
                backgroundColor: '#191C24',
                borderRadius: 14,
                border: '1px solid #262B36',
                padding: '0 16px',
                color: '#FFFFFF',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9EA4B3', marginBottom: 6 }}>
            Adresse email
          </label>
          <input
            type="email"
            placeholder="nom@exemple.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: '100%',
              height: 50,
              backgroundColor: '#191C24',
              borderRadius: 14,
              border: '1px solid #262B36',
              padding: '0 16px',
              color: '#FFFFFF',
              fontSize: 14,
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9EA4B3', marginBottom: 6 }}>
            Mot de passe (8 caractères minimum)
          </label>
          <div style={{ position: 'relative', width: '100%' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              style={{
                width: '100%',
                height: 50,
                backgroundColor: '#191C24',
                borderRadius: 14,
                border: '1px solid #262B36',
                padding: '0 45px 0 16px',
                color: '#FFFFFF',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#7C8394',
                cursor: 'pointer',
              }}
            >
              {showPassword ? <IoEyeOffOutline size={18} /> : <IoEyeOutline size={18} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            marginTop: 10,
            height: 52,
            backgroundColor: canSubmit ? '#FFFFFF' : '#2B303C',
            color: canSubmit ? '#09090F' : '#7C8394',
            borderRadius: 18,
            fontWeight: 700,
            fontSize: 15,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            transition: 'all 0.18s ease',
            boxShadow: canSubmit ? '0 4px 15px rgba(255, 255, 255, 0.2)' : 'none',
          }}
        >
          {busy ? 'Vérification...' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
        </button>
      </form>
    </div>
  );
};
