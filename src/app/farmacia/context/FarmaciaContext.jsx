'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import useFarmacia from '../hooks/useFarmacia';

const FarmaciaContext = createContext();

export const FarmaciaProvider = ({ children }) => {
  const [theme, setTheme] = useState('light');
  const [usuarios, setUsuarios] = useState([]);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(true);
  const [errorUsuarios, setErrorUsuarios] = useState(null);

  useEffect(() => {
    const usersRef = ref(db, 'usuarios');
    const unsubscribe = onValue(
      usersRef,
      (snapshot) => {
        const data = snapshot.val() || {};
        const lista = Object.entries(data).map(([key, val]) => ({
          id: key,
          ...val,
        }));
        setUsuarios(lista);
        setCargandoUsuarios(false);

        if (lista.length > 0) {
          const farmacia = lista.find(
            (u) => u.TipoEmpleado === 'Farmacia' || u.TipoEmpleado === 'ADM'
          );
          const seleccionado = farmacia || lista[0];
          setUsuarioActual({
            nombre: seleccionado.nombre || 'Usuario',
            rol: seleccionado.TipoEmpleado || 'Sin rol',
            id: seleccionado.id,
          });
        } else {
          setUsuarioActual({
            nombre: 'Farmacia',
            rol: 'Farmacia',
            id: 'default',
          });
        }
      },
      (error) => {
        console.error('Error al cargar usuarios:', error);
        setErrorUsuarios(error.message);
        setCargandoUsuarios(false);
        setUsuarioActual({
          nombre: 'Farmacia',
          rol: 'Farmacia',
          id: 'default',
        });
      }
    );

    return () => unsubscribe();
  }, []);

  const hook = useFarmacia(usuarioActual);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleSelectUser = (userId) => {
    const user = usuarios.find((u) => u.id === userId);
    if (user) {
      setUsuarioActual({
        nombre: user.nombre || 'Usuario',
        rol: user.TipoEmpleado || 'Sin rol',
        id: user.id,
      });
    }
  };

  const value = {
    theme,
    toggleTheme,
    usuarios,
    usuarioActual,
    cargandoUsuarios,
    errorUsuarios,
    handleSelectUser,
    ...hook,
  };

  return (
    <FarmaciaContext.Provider value={value}>
      {children}
    </FarmaciaContext.Provider>
  );
};

export const useFarmaciaContext = () => {
  const context = useContext(FarmaciaContext);
  if (!context) {
    throw new Error('useFarmaciaContext debe usarse dentro de FarmaciaProvider');
  }
  return context;
};
