import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { add, update, query, generateId } from '../services/storage';
import { getCurrentUser } from '../services/auth';
import { seedDemoData } from '../services/seedData';

export default function ClockIn() {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [clockingIn, setClockingIn] = useState(false);
  const [lastPunch, setLastPunch] = useState(null);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [gettingLocation, setGettingLocation] = useState(false);

  // Seed demo data once on mount
  useEffect(() => {
    seedDemoData();
  }, []);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocalização não suportada pelo navegador');
      return;
    }
    setGettingLocation(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setGettingLocation(false);
      },
      () => {
        setLocationError('Permita o acesso à localização para bater o ponto');
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Get location on mount
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  const getNextPunchType = useCallback(() => {
    const user = getCurrentUser();
    if (!user) return { type: 'entrada', label: 'Entrada', icon: '🟢' };

    const today = new Date().toISOString().split('T')[0];
    const records = query('timeRecords', r => r.userId === user.id && r.date === today);

    if (records.length === 0) return { type: 'entrada', label: 'Entrada', icon: '🟢' };

    const rec = records[0];
    if (!rec.entrada) return { type: 'entrada', label: 'Entrada', icon: '🟢' };
    if (!rec.almoco_ida) return { type: 'almoco_ida', label: 'Almoço (Saída)', icon: '🍽️' };
    if (!rec.almoco_volta) return { type: 'almoco_volta', label: 'Almoço (Retorno)', icon: '🍽️' };
    if (!rec.saida) return { type: 'saida', label: 'Saída', icon: '🔴' };
    return { type: 'done', label: 'Completo', icon: '✅' };
  }, []);

  const handleClockIn = useCallback(() => {
    const user = getCurrentUser();
    if (!user) {
      navigate('/login');
      return;
    }

    if (!location) {
      requestLocation();
      return;
    }

    setClockingIn(true);

    setTimeout(() => {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const existing = query('timeRecords', r => r.userId === user.id && r.date === today);
      const punchType = getNextPunchType();

      if (punchType.type === 'done') {
        setClockingIn(false);
        return;
      }

      const locationData = {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
      };

      if (existing.length > 0) {
        const rec = existing[0];
        update('timeRecords', rec.id, {
          [punchType.type]: timeStr,
          [`${punchType.type}_location`]: locationData,
          registrationTimestamp: now.toISOString(),
        });
      } else {
        add('timeRecords', {
          id: generateId(),
          userId: user.id,
          date: today,
          entrada: timeStr,
          entrada_location: locationData,
          almoco_ida: null,
          almoco_volta: null,
          saida: null,
          status: 'pending',
          homologated: false,
          homologatedBy: null,
          homologatedAt: null,
          loginTimestamp: now.toISOString(),
          registrationTimestamp: now.toISOString(),
        });
      }

      setLastPunch({
        type: punchType.label,
        time: timeStr,
        date: now.toLocaleDateString('pt-BR'),
        location: locationData,
        userName: user.name,
      });
      setClockingIn(false);
    }, 800);
  }, [location, navigate, requestLocation, getNextPunchType]);

  const punchInfo = getNextPunchType();
  const user = getCurrentUser();

  const timeString = currentTime.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const dateString = currentTime.toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.15), transparent)', animation: 'pulse-glow 4s ease-in-out infinite' }} />
        <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(67,56,202,0.12), transparent)', animation: 'pulse-glow 4s ease-in-out infinite 2s' }} />
      </div>

      {/* Header with logo */}
      <div className="text-center mb-8 slide-up relative z-10">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-4"
          style={{
            background: 'linear-gradient(135deg, var(--color-brand-600), var(--color-brand-500))',
            boxShadow: '0 12px 40px rgba(99, 102, 241, 0.4)',
          }}>
          <span className="text-4xl">⏱️</span>
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-[var(--color-brand-300)] to-[var(--color-brand-500)] bg-clip-text text-transparent">
          PontoFlow
        </h1>
        <p className="text-[var(--color-surface-300)] mt-1 text-sm">
          Sistema de Ponto Eletrônico
        </p>
      </div>

      {/* Live Clock */}
      <div className="text-center mb-8 slide-up relative z-10" style={{ animationDelay: '0.1s' }}>
        <p className="text-6xl lg:text-7xl font-bold text-white tracking-wider" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {timeString}
        </p>
        <p className="text-[var(--color-surface-300)] mt-2 capitalize">
          {dateString}
        </p>
      </div>

      {/* User info */}
      {user && (
        <div className="text-center mb-4 slide-up relative z-10" style={{ animationDelay: '0.15s' }}>
          <p className="text-sm text-[var(--color-surface-300)]">
            Olá, <span className="text-white font-semibold">{user.name?.split(' ')[0]}</span> 👋
          </p>
        </div>
      )}

      {/* Clock In Button */}
      <div className="slide-up relative z-10" style={{ animationDelay: '0.2s' }}>
        {punchInfo.type !== 'done' ? (
          <button
            onClick={handleClockIn}
            disabled={clockingIn}
            className="group relative"
            style={{ outline: 'none', border: 'none', background: 'none', cursor: 'pointer' }}
          >
            {/* Pulse ring */}
            <div className="absolute inset-0 rounded-full"
              style={{
                background: 'linear-gradient(135deg, var(--color-brand-600), var(--color-brand-500))',
                animation: 'pulse-glow 2s ease-in-out infinite',
                transform: 'scale(1.15)',
                opacity: 0.3,
                borderRadius: '50%',
              }} />
            {/* Main button */}
            <div className="relative w-44 h-44 lg:w-52 lg:h-52 rounded-full flex flex-col items-center justify-center transition-all duration-300 group-hover:scale-105"
              style={{
                background: clockingIn
                  ? 'linear-gradient(135deg, #059669, #10b981)'
                  : 'linear-gradient(135deg, var(--color-brand-600), var(--color-brand-500))',
                boxShadow: clockingIn
                  ? '0 12px 50px rgba(16, 185, 129, 0.5)'
                  : '0 12px 50px rgba(99, 102, 241, 0.4)',
              }}>
              {clockingIn ? (
                <span className="text-5xl animate-spin">⏳</span>
              ) : (
                <>
                  <span className="text-4xl mb-1">{punchInfo.icon}</span>
                  <span className="text-white font-bold text-xl">BATER</span>
                  <span className="text-white/80 text-sm">{punchInfo.label}</span>
                </>
              )}
            </div>
          </button>
        ) : (
          <div className="w-44 h-44 lg:w-52 lg:h-52 rounded-full flex flex-col items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #059669, #10b981)',
              boxShadow: '0 12px 50px rgba(16, 185, 129, 0.3)',
            }}>
            <span className="text-4xl mb-1">✅</span>
            <span className="text-white font-bold text-base">COMPLETO</span>
            <span className="text-white/80 text-xs">Todos os registros feitos</span>
          </div>
        )}
      </div>

      {/* Location status */}
      <div className="mt-6 text-center slide-up relative z-10" style={{ animationDelay: '0.3s' }}>
        {gettingLocation ? (
          <p className="text-sm text-[var(--color-surface-300)] flex items-center gap-2 justify-center">
            <span className="animate-spin">📍</span> Obtendo localização...
          </p>
        ) : location ? (
          <div className="text-xs text-[var(--color-surface-300)]">
            <p className="flex items-center gap-1 justify-center">
              📍 Localização capturada
              <span className="text-[var(--color-success)]">✓</span>
            </p>
            <p className="mt-1 opacity-60">
              {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
              {location.accuracy && ` (±${Math.round(location.accuracy)}m)`}
            </p>
          </div>
        ) : locationError ? (
          <div>
            <p className="text-sm text-[var(--color-warning)]">{locationError}</p>
            <button onClick={requestLocation} className="text-xs text-[var(--color-brand-400)] hover:underline mt-1">
              Tentar novamente
            </button>
          </div>
        ) : null}
      </div>

      {/* Last punch result */}
      {lastPunch && (
        <div className="mt-6 glass-card-static text-center max-w-sm w-full slide-up relative z-10">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-[var(--color-success)] text-lg">✅</span>
            <p className="text-white font-semibold">Ponto Registrado!</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[var(--color-surface-300)] text-xs">Tipo</p>
              <p className="text-white font-medium">{lastPunch.type}</p>
            </div>
            <div>
              <p className="text-[var(--color-surface-300)] text-xs">Horário</p>
              <p className="text-white font-medium">{lastPunch.time}</p>
            </div>
            <div>
              <p className="text-[var(--color-surface-300)] text-xs">Data</p>
              <p className="text-white font-medium">{lastPunch.date}</p>
            </div>
            <div>
              <p className="text-[var(--color-surface-300)] text-xs">Local</p>
              <p className="text-white font-medium text-xs">
                {lastPunch.location.latitude.toFixed(4)}, {lastPunch.location.longitude.toFixed(4)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Access System Button */}
      <div className="mt-8 flex flex-col items-center gap-3 slide-up relative z-10" style={{ animationDelay: '0.4s' }}>
        {user ? (
          <button
            onClick={() => navigate(user.role === 'manager' ? '/gestor' : '/dashboard')}
            className="btn-primary flex items-center gap-2 px-8 py-3"
          >
            🖥️ Acessar Sistema
          </button>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="btn-primary flex items-center gap-2 px-8 py-3"
          >
            🔐 Fazer Login
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 text-center relative z-10">
        <p className="text-xs text-[var(--color-surface-300)] opacity-50">
          PontoFlow © {new Date().getFullYear()} • Ponto Eletrônico
        </p>
      </div>
    </div>
  );
}
