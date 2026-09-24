import React, { useState } from 'react';
import {
  IoLogOutOutline,
  IoTrophyOutline,
  IoEyeOutline,
  IoEyeOffOutline,
  IoHeart,
  IoTime,
  IoCloudDoneOutline,
} from 'react-icons/io5';
import { AvatarPlaceholder } from '../../mobile/components/AvatarPlaceholder';
import { useAuth } from '../../shared/hooks/useAuth';

interface DesktopProfileViewProps {
  favoritesCount: number;
  historyCount: number;
}

export const DesktopProfileView: React.FC<DesktopProfileViewProps> = ({
  favoritesCount,
  historyCount,
}) => {
  const { user, login, register, logout, error, clearError } = useAuth();
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
      /* handled */
    } finally {
      setBusy(false);
    }
  };

  if (user) {
    return (
      <div style={{ padding: '0 40px 60px', maxWidth: 800 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#FFFFFF', marginBottom: 28 }}>
          Mon Compte & Paramètres
        </h1>

        {/* Profile Card */}
        <div
          style={{
            backgroundColor: '#1A1F29',
            borderRadius: 24,
            padding: 32,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.4)',
            marginBottom: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <AvatarPlaceholder size={84} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: '#FFFFFF' }}>
                  {user.name || 'Daizy'}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#FFB800',
                    backgroundColor: 'rgba(255, 184, 0, 0.15)',
                    padding: '3px 8px',
                    borderRadius: 6,
                    border: '1px solid rgba(255, 184, 0, 0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <IoTrophyOutline size={12} /> VIP MEMBRE
                </span>
              </div>
              <div style={{ fontSize: 14, color: '#9EA4B3', marginTop: 4 }}>
                {user.email}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: '#10B981',
                  marginTop: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <IoCloudDoneOutline size={16} /> Synchronisé avec le Cloud
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 20px',
              borderRadius: 14,
              backgroundColor: '#2B303C',
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(229, 9, 20, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(229, 9, 20, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#2B303C';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
            }}
          >
            <IoLogOutOutline size={18} />
            <span>Déconnexion</span>
          </button>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
          <div
            style={{
              backgroundColor: '#1A1F29',
              borderRadius: 20,
              padding: 24,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
              }}
            >
              <IoHeart size={24} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF' }}>{favoritesCount}</div>
              <div style={{ fontSize: 13, color: '#9EA4B3' }}>Films & séries en favoris</div>
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#1A1F29',
              borderRadius: 20,
              padding: 24,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
              }}
            >
              <IoTime size={24} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF' }}>{historyCount}</div>
              <div style={{ fontSize: 13, color: '#9EA4B3' }}>Vidéos en cours de lecture</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 40px 60px', maxWidth: 480 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#FFFFFF', marginBottom: 8 }}>
        Mon Compte
      </h1>
      <p style={{ fontSize: 14, color: '#7C8394', marginBottom: 24 }}>
        Connectez-vous pour synchroniser vos favoris et votre progression sur tous vos appareils.
      </p>

      {/* Switch Connexion / Inscription */}
      <div
        style={{
          display: 'flex',
          backgroundColor: '#191C24',
          borderRadius: 16,
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
            borderRadius: 12,
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
            borderRadius: 12,
            transition: 'all 0.15s ease',
          }}
        >
          Inscription
        </button>
      </div>

      {error && (
        <div
          style={{
            backgroundColor: 'rgba(229, 9, 20, 0.15)',
            border: '1px solid rgba(229, 9, 20, 0.4)',
            borderRadius: 14,
            padding: '12px 16px',
            color: '#FFFFFF',
            fontSize: 13,
            marginBottom: 20,
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {mode === 'register' && (
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#9EA4B3', marginBottom: 6 }}>
              Nom ou pseudo
            </label>
            <input
              type="text"
              placeholder="Daizy"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                height: 48,
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
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#9EA4B3', marginBottom: 6 }}>
            Adresse email
          </label>
          <input
            type="email"
            placeholder="votre@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: '100%',
              height: 48,
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
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#9EA4B3', marginBottom: 6 }}>
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
                height: 48,
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
            marginTop: 8,
            height: 50,
            backgroundColor: canSubmit ? '#FFFFFF' : '#2B303C',
            color: canSubmit ? '#09090F' : '#7C8394',
            borderRadius: 16,
            fontWeight: 700,
            fontSize: 15,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s ease',
          }}
        >
          {busy ? 'Connexion en cours...' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
        </button>
      </form>
    </div>
  );
};
