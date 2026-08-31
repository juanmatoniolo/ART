"use client";
import { createContext, useContext, useState, useEffect } from "react";
import useFarmacia from "../hooks/useFarmacia";
import { useSession } from "@/context/SessionContext";

const FarmaciaContext = createContext();

export const FarmaciaProvider = ({ children }) => {
  const { usuario } = useSession();
  const [theme, setTheme] = useState("light");
  const [usuarioActual, setUsuarioActual] = useState(usuario);

  const farmacia = useFarmacia(usuarioActual);

  useEffect(() => {
    setUsuarioActual(usuario);
  }, [usuario]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <FarmaciaContext.Provider
      value={{
        ...farmacia, // incluye editarMovimiento
        theme,
        toggleTheme,
        usuarioActual,
      }}
    >
      {children}
    </FarmaciaContext.Provider>
  );
};

export const useFarmaciaContext = () => useContext(FarmaciaContext);