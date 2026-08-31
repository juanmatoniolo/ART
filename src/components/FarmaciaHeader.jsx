"use client";
import { useSession } from "@/context/SessionContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import s from "./FarmaciaHeader.module.css";

export default function FarmaciaHeader() {
  const { usuario, logout } = useSession();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header className={s.header}>
      <div className={s.headerLeft}>
        <Link href="/farmacia" className={s.brand}>
          🏥 Farmacia
        </Link>
      </div>
      <div className={s.headerRight}>
        {usuario ? (
          <>
            <div className={s.userInfo}>
              <span className={s.userName}>{usuario.nombre}</span>
              <span className={s.userLogin}>({usuario.user})</span>
              <span className={s.userRole}>{usuario.TipoEmpleado}</span>
            </div>
            <button onClick={handleLogout} className={s.logoutBtn} title="Cerrar sesión">
              Salir
            </button>
          </>
        ) : (
          <Link href="/login" className={s.loginLink}>
            Iniciar sesión
          </Link>
        )}
      </div>
    </header>
  );
}