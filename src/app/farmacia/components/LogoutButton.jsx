"use client";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { auth } from "@/lib/firebase"; // 👈 importamos directamente
import s from "../farmaciaDashboard.module.css";

export default function LogoutButton({ theme }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      setLoading(false);
    }
  };

  return (
    <button
      className={`${s.logoutBtn} ${s[theme]}`}
      onClick={handleLogout}
      disabled={loading}
      title="Cerrar sesión"
    >
      <span className={s.logoutIcon}>🚪</span>
      {loading ? "Saliendo..." : "Salir"}
    </button>
  );
}s