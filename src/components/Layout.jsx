import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { getCurrentUser, isAdmin, hasManagerAccess, logout } from '../services/auth';

const collaboratorLinks = [
  { to: '/dashboard', icon: '🏠', label: 'Dashboard' },
  { to: '/registrar', icon: '⏱️', label: 'Registrar' },
  { to: '/extrato', icon: '📊', label: 'Extrato' },
  { to: '/comprovantes', icon: '📄', label: 'Comprovantes' },
  { to: '/justificativas', icon: '📎', label: 'Justificativas' },
  { to: '/ferias', icon: '🏖️', label: 'Férias' },
];

const managerLinks = [
  { to: '/gestor', icon: '🏠', label: 'Dashboard' },
  { to: '/gestor/homologacao', icon: '✅', label: 'Homologação' },
  { to: '/gestor/colaboradores', icon: '👥', label: 'Colaboradores' },
  { to: '/gestor/relatorios', icon: '📋', label: 'Relatórios' },
  { to: '/gestor/auditoria', icon: '🔍', label: 'Auditoria' },
  { to: '/gestor/ferias', icon: '🏖️', label: 'Férias' },
];

const adminLinks = [
  { to: '/admin', icon: '🛡️', label: 'Admin Painel' },
  { to: '/gestor', icon: '🏠', label: 'Dashboard' },
  { to: '/gestor/homologacao', icon: '✅', label: 'Homologação' },
  { to: '/gestor/colaboradores', icon: '👥', label: 'Colaboradores' },
  { to: '/gestor/relatorios', icon: '📋', label: 'Relatórios' },
  { to: '/gestor/auditoria', icon: '🔍', label: 'Auditoria' },
  { to: '/gestor/ferias', icon: '🏖️', label: 'Férias' },
];

export default function Layout() {
  const navigate = useNavigate();
  const user = getCurrentUser();

  const links = isAdmin()
    ? adminLinks
    : hasManagerAccess()
      ? managerLinks
      : collaboratorLinks;

  const panelLabel = isAdmin()
    ? '🛡️ Admin Master'
    : hasManagerAccess()
      ? '👑 Painel do Gestor'
      : '👤 Painel do Colaborador';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const avatarGradient = isAdmin()
    ? 'linear-gradient(135deg, #dc2626, #ef4444)'
    : hasManagerAccess()
      ? 'linear-gradient(135deg, #7c3aed, #4f46e5)'
      : 'linear-gradient(135deg, var(--color-brand-500), var(--color-brand-700))';

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 fixed h-full z-30"
        style={{
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}>
        <div className="p-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[var(--color-brand-400)] to-[var(--color-brand-300)] bg-clip-text text-transparent">
            PontoFlow
          </h1>
          <p className="text-xs text-[var(--color-surface-300)] mt-1">{panelLabel}</p>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto pb-2">
          {links.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/dashboard' || link.to === '/gestor' || link.to === '/admin'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-[var(--color-brand-600)]/20 text-[var(--color-brand-300)] border border-[var(--color-brand-500)]/20'
                    : 'text-[var(--color-surface-300)] hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <span className="text-lg">{link.icon}</span>
              {link.label}
              {/* Admin badge on admin link */}
              {link.to === '/admin' && (
                <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171', fontSize: '0.65rem' }}>
                  DEV
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5">
          <button
            onClick={() => navigate('/perfil')}
            className="w-full flex items-center gap-3 px-3 mb-3 rounded-xl py-2 transition-all hover:bg-white/5 text-left"
            style={{ background: 'none', border: 'none', cursor: 'pointer', minHeight: 'auto' }}
          >
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
              style={{ background: avatarGradient }}>
              {user?.name?.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-[var(--color-surface-300)] truncate">{user?.matricula || user?.email}</p>
            </div>
            <span className="text-xs text-[var(--color-surface-300)]">👤</span>
          </button>
          <button onClick={handleLogout} className="w-full btn-secondary text-sm">
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
        <h1 className="text-xl font-bold bg-gradient-to-r from-[var(--color-brand-400)] to-[var(--color-brand-300)] bg-clip-text text-transparent">
          PontoFlow
        </h1>
        <div className="flex items-center gap-2">
          {isAdmin() && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>
              ADMIN
            </span>
          )}
          <button
            onClick={() => navigate('/perfil')}
            className="flex items-center gap-1.5"
            style={{ background: 'none', border: 'none', minHeight: 'auto', cursor: 'pointer', padding: '4px 8px', borderRadius: '8px' }}
          >
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: avatarGradient }}>
              {user?.name?.charAt(0)}
            </div>
            <span className="text-sm text-[var(--color-surface-300)]">{user?.name?.split(' ')[0]}</span>
          </button>
          <button onClick={handleLogout} className="text-[var(--color-surface-300)] hover:text-white text-sm"
            style={{ background: 'none', border: 'none', minHeight: 'auto', padding: '4px 8px', cursor: 'pointer' }}>
            Sair
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 lg:ml-64">
        <div className="pt-16 lg:pt-0 pb-24 lg:pb-6 px-4 lg:px-8 py-6 lg:py-8 min-h-screen">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex justify-around items-center py-2"
        style={{
          background: 'rgba(15, 23, 42, 0.98)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
        {links.slice(0, 5).map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/dashboard' || link.to === '/gestor' || link.to === '/admin'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-all text-xs ${
                isActive
                  ? 'text-[var(--color-brand-400)]'
                  : 'text-[var(--color-surface-300)]'
              }`
            }
          >
            <span className="text-xl">{link.icon}</span>
            <span className="font-medium">{link.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
