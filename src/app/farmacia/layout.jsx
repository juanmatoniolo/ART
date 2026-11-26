'use client';
import { FarmaciaProvider, useFarmaciaContext } from './context/FarmaciaContext';
import StatsHeader from './components/StatsHeader';
import TabNav from './components/TabNav';
import s from './farmaciaDashboard.module.css';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import RoleGate from '@/components/RoleGate/RoleGate';
import { AREAS } from '@/lib/roles';
import { useSession } from '@/context/SessionContext';

function FarmaciaLayoutContent({ children }) {
  const {
    theme,
    toggleTheme,
    usuarios,
    usuarioActual,
    cargandoUsuarios,
    errorUsuarios,
    handleSelectUser,
  } = useFarmaciaContext();

  const pathname = usePathname();
  const router = useRouter();
  const [loadingLogout, setLoadingLogout] = useState(false);

  const getActiveTabFromPath = () => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 1) return 'dashboard';
    return segments[1];
  };

  const activeTab = getActiveTabFromPath();

  const { logout } = useSession();
  const handleLogout = async () => {
    setLoadingLogout(true);
    await logout();
    router.replace('/login');
  };

  if (cargandoUsuarios) {
    return <div className={s.loading}>Cargando usuarios...</div>;
  }

  if (errorUsuarios) {
    return (
      <div className={s.errorState}>
        <p>Error al cargar usuarios: {errorUsuarios}</p>
        <button onClick={() => window.location.reload()}>Reintentar</button>
      </div>
    );
  }

  return (
    <div className={`${s.dashboardContainer} ${s[theme]}`}>
      <StatsHeader
        theme={theme}
        toggleTheme={toggleTheme}
        onLogout={handleLogout}
        loadingLogout={loadingLogout}
        usuario={usuarioActual?.nombre || ''}
        rol={usuarioActual?.rol || ''}
        usuarios={usuarios}
        onSelectUser={handleSelectUser}
        usuarioSeleccionado={usuarioActual}
        onIngresoMercaderia={() => router.push('/farmacia/carga-masiva')}
      />

      <TabNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === 'dashboard') {
            router.push('/farmacia');
          } else {
            router.push(`/farmacia/${tab}`);
          }
        }}
      />

      <main className={s.mainContent}>{children}</main>
    </div>
  );
}

export default function FarmaciaLayout({ children }) {
  return (
    <RoleGate allowed={AREAS['/farmacia']}>
      <FarmaciaProvider>
        <FarmaciaLayoutContent>{children}</FarmaciaLayoutContent>
      </FarmaciaProvider>
    </RoleGate>
  );
}