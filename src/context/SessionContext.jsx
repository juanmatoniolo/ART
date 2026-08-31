"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { getSession, setSession, clearSession } from "../utils/session";

const SessionContext = createContext();

export function SessionProvider({ children }) {
  const [usuario, setUsuario] = useState(null);

  // Al montar, leer sesión existente
  useEffect(() => {
    const session = getSession();
    if (session) {
      setUsuario(session);
    }
  }, []);

  const login = (userData) => {
    setSession(userData); // guarda en localStorage
    setUsuario(userData); // actualiza estado
  };

  const logout = () => {
    clearSession();
    setUsuario(null);
  };

  return (
    <SessionContext.Provider value={{ usuario, login, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);