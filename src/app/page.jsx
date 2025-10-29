'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSession, clearSession } from '@/utils/session';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const [usuario, setUsuario] = useState(null);
  const router = useRouter();

  // 🔹 Detectar si hay sesión
  useEffect(() => {
    const session = getSession();
    if (session) {
      setUsuario(session);
    }
  }, []);

  // 🔹 Cerrar sesión
  const handleLogout = () => {
    clearSession();
    setUsuario(null);
    router.push('/login');
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      {/* 🔹 NAVBAR SUPERIOR */}
      <nav className="navbar navbar-expand-lg navbar-light bg-white border-bottom shadow-sm">
        <div className="container d-flex justify-content-between align-items-center py-2">
          <Link href="/" className="navbar-brand fw-bold text-success fs-5">
            🏥 Clínica de la Unión S.A.
          </Link>

          <div>
            {!usuario ? (
              <>
                <Link href="/login" className="btn btn-outline-success btn-sm me-2">
                  🔑 Iniciar sesión
                </Link>
                <Link href="/register" className="btn btn-success btn-sm">
                  🧾 Registrarse
                </Link>
              </>
            ) : (
              <div className="d-flex align-items-center gap-2">
                <span className="text-muted small">
                  👤 {usuario.Nombre} {usuario.Apellido} ({usuario.TipoEmpleado})
                </span>
                <button className="btn btn-outline-danger btn-sm" onClick={handleLogout}>
                  🚪 Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* 🔹 CONTENIDO PRINCIPAL */}
      <main className="flex-grow-1 d-flex flex-column justify-content-center align-items-center text-center p-4">
        <h1 className="display-5 mb-3 text-success">Bienvenido al Sistema de Gestión Médica</h1>
        <p className="lead mb-4">Gestione pacientes, evoluciones y pedidos de manera simple y segura.</p>

        {!usuario ? (
          <div>
            <Link href="/login" className="btn btn-success btn-lg me-3">
              Iniciar sesión
            </Link>
            <Link href="/register" className="btn btn-outline-success btn-lg">
              Registrarse
            </Link>
          </div>
        ) : (
          <div>
            <p className="text-muted mb-3">
              Estás conectado como <strong>{usuario.Nombre} {usuario.Apellido}</strong> ({usuario.TipoEmpleado})
            </p>
            {usuario.TipoEmpleado === 'ADM' && (
              <Link href="/admin" className="btn btn-success btn-lg">
                Ir al panel administrativo
              </Link>
            )}
            {usuario.TipoEmpleado === 'DR' && (
              <Link href="/doctores" className="btn btn-primary btn-lg">
                Ir al panel médico
              </Link>
            )}
            {usuario.TipoEmpleado === 'MDE' && (
              <Link href="/mesa-de-entrada" className="btn btn-info btn-lg">
                Ir a mesa de entrada
              </Link>
            )}
          </div>
        )}
      </main>

      {/* 🔹 FOOTER */}
      <footer className="text-center text-muted py-3 border-top small">
        © {new Date().getFullYear()} Clínica de la Unión S.A. — Sistema Médico Interno
      </footer>
    </div>
  );
}
