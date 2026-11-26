"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { onValue, ref } from "firebase/database";
import { auth, db } from "@/lib/firebase";
import { toLoginEmail } from "@/lib/roles";
import { buildSession, clearSession, getSession, setSession } from "@/utils/session";
import { installDbRestAuth } from "@/lib/dbRestAuth";

export const SessionContext = createContext(null);

// status:
//   "loading"   esperando a Firebase
//   "anonymous" sin sesión
//   "active"    sesión válida y usuario activo
//   "suspended" el usuario existe pero tiene el servicio cortado
//   "noprofile" autenticado en Firebase pero sin perfil en usuarios/{uid}
export function SessionProvider({ children }) {
  const [status, setStatus] = useState("loading");
  const [usuario, setUsuario] = useState(null);

  useEffect(() => {
    installDbRestAuth();
    let unsubProfile = null;

    const unsubAuth = onAuthStateChanged(auth, (authUser) => {
      unsubProfile?.();
      unsubProfile = null;

      if (!authUser) {
        clearSession();
        setUsuario(null);
        setStatus((s) => (s === "suspended" || s === "noprofile" ? s : "anonymous"));
        return;
      }

      // Perfil en vivo: si ROOT corta el servicio o cambia roles, se aplica al instante.
      unsubProfile = onValue(
        ref(db, `usuarios/${authUser.uid}`),
        (snap) => {
          const profile = snap.val();
          if (!profile) {
            setStatus("noprofile");
            clearSession();
            setUsuario(null);
            signOut(auth);
            return;
          }
          if (profile.activo !== true) {
            setStatus("suspended");
            clearSession();
            setUsuario(null);
            signOut(auth);
            return;
          }
          const session = buildSession(authUser, profile);
          setSession(session);
          setUsuario(session);
          setStatus("active");
        },
        () => {
          // Sin permiso para leer el propio perfil = cuenta deshabilitada o reglas
          setStatus("suspended");
          clearSession();
          setUsuario(null);
          signOut(auth);
        }
      );
    });

    return () => {
      unsubProfile?.();
      unsubAuth();
    };
  }, []);

  const login = useCallback(async (identifier, password) => {
    setStatus("loading");
    try {
      await signInWithEmailAndPassword(auth, toLoginEmail(identifier), password);
    } catch (err) {
      setStatus("anonymous");
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    clearSession();
    try {
      sessionStorage.removeItem("impersonation");
    } catch {}
    setUsuario(null);
    setStatus("anonymous");
    await signOut(auth);
  }, []);

  // Mientras Firebase restaura la sesión, usamos el caché para no parpadear.
  const value = useMemo(
    () => ({
      status,
      usuario: usuario || (status === "loading" ? getSession() : null),
      login,
      logout,
    }),
    [status, usuario, login, logout]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
