"use client";

import { useState, useEffect } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "@/lib/firebase";
import useFarmacia from "./hooks/useFarmacia";
import StatsHeader from "./components/StatsHeader";
import TabNav from "./components/TabNav";
import DashboardTab from "./components/DashboardTab";
import StockTab from "./components/StockTab";
import MovimientosTab from "./components/MovimientosTab";
import ExportarTab from "./components/ExportarTab";
import AgregarModal from "./components/modals/AgregarModal";
import CargaMasivaModal from "./components/modals/CargaMasivaModal";
import ImportarExcelModal from "./components/modals/ImportarExcelModal";
import MensajeModal from "./components/modals/MensajeModal";
import ListasPreciosTab from "./components/ListasPreciosTab";
import s from "./farmaciaDashboard.module.css";
import MedicacionyDescartables from "./components/MedicacionyDescartables";

export default function FarmaciaDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [modal, setModal] = useState(null);
  const [theme, setTheme] = useState("light");
  const [loadingLogout, setLoadingLogout] = useState(false);

  const [usuarios, setUsuarios] = useState([]);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(true);
  const [errorUsuarios, setErrorUsuarios] = useState(null);

  useEffect(() => {
    const usersRef = ref(db, "usuarios");
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
          const farmacia = lista.find(u => u.TipoEmpleado === "Farmacia" || u.TipoEmpleado === "ADM");
          const seleccionado = farmacia || lista[0];
          setUsuarioActual({
            nombre: seleccionado.nombre || "Usuario",
            rol: seleccionado.TipoEmpleado || "Sin rol",
            id: seleccionado.id,
          });
        } else {
          setUsuarioActual({
            nombre: "Farmacia",
            rol: "Farmacia",
            id: "default",
          });
        }
      },
      (error) => {
        console.error("Error al cargar usuarios:", error);
        setErrorUsuarios(error.message);
        setCargandoUsuarios(false);
        setUsuarioActual({
          nombre: "Farmacia",
          rol: "Farmacia",
          id: "default",
        });
      }
    );

    return () => unsubscribe();
  }, []);

  const handleSelectUser = (userId) => {
    const user = usuarios.find(u => u.id === userId);
    if (user) {
      setUsuarioActual({
        nombre: user.nombre || "Usuario",
        rol: user.TipoEmpleado || "Sin rol",
        id: user.id,
      });
    }
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const hook = useFarmacia(usuarioActual);

  const {
    items,
    movimientos,
    estadisticas,
    itemsBajoStockList,
    mensaje,
    cerrarMensaje,
    agregarProducto,
    cargarCatalogo,
    procesarCargaMasiva,
    procesarReparto,
    editarProducto,
    eliminarProducto,
    importarDesdeExcel,
    exportarDatos,
    listasPrecios,
    guardarListaPrecio,
    eliminarListaPrecio,
    exportarListasPrecios,
    eliminarMovimiento,
  } = hook;

  const handleCloseModal = () => setModal(null);

  const handleLogout = () => {
    setLoadingLogout(true);
    setTimeout(() => {
      window.location.href = '/';
    }, 300);
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

  if (!usuarioActual) {
    setUsuarioActual({ nombre: "Farmacia", rol: "Farmacia", id: "default" });
    return null;
  }

  return (
    <div className={`${s.dashboardContainer} ${s[theme]}`}>
      <StatsHeader
        estadisticas={estadisticas}
        onAgregar={() => setModal("agregar")}
        onCargaMasiva={() => setModal("masiva")}
        repartoHref="/farmacia/reparto"
        onExportar={() => setActiveTab("exportar")}
        theme={theme}
        toggleTheme={toggleTheme}
        onLogout={handleLogout}
        loadingLogout={loadingLogout}
        usuario={usuarioActual.nombre}
        rol={usuarioActual.rol}
        usuarios={usuarios}
        onSelectUser={handleSelectUser}
        usuarioSeleccionado={usuarioActual}
      />

      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

      <main className={s.mainContent}>
        {activeTab === "dashboard" && (
          <DashboardTab
            estadisticas={estadisticas}
            itemsBajoStockList={itemsBajoStockList}
            movimientos={movimientos}
          />
        )}

        {activeTab === "stock" && (
          <StockTab
            items={items}
            estadisticas={estadisticas}
            onAgregar={() => setModal("agregar")}
            onCargaMasiva={() => setModal("masiva")}
            onImportar={() => setModal("importar")}
            editarProducto={editarProducto}
            eliminarProducto={eliminarProducto}
          />
        )}

        {activeTab === "precios" && (
          <ListasPreciosTab
            items={items}
            listas={listasPrecios}
            onGuardarLista={guardarListaPrecio}
            onEliminarLista={eliminarListaPrecio}
            onActualizarItem={editarProducto}
          />
        )}

        {activeTab === "movimientos" && (
          <MovimientosTab
            movimientos={movimientos}
            userRole={usuarioActual.rol}
            onEliminarMovimiento={eliminarMovimiento}
          />
        )}

        {activeTab === "catalogo" && (
          <div className={s.panel}>
            <MedicacionyDescartables />
          </div>
        )}

        {activeTab === "exportar" && (
          <ExportarTab
            estadisticas={estadisticas}
            movimientos={movimientos}
            onExportar={(tipo) =>
              exportarDatos({ tipo, incluirSinStock: true }, movimientos)
            }
          />
        )}
      </main>

      {modal === "agregar" && (
        <AgregarModal onClose={handleCloseModal} onSubmit={agregarProducto} />
      )}

      {modal === "masiva" && (
        <CargaMasivaModal
          onClose={handleCloseModal}
          onSubmit={procesarCargaMasiva}
          cargarCatalogo={cargarCatalogo}
        />
      )}

      {modal === "importar" && (
        <ImportarExcelModal
          onClose={handleCloseModal}
          onSubmit={importarDesdeExcel}
        />
      )}

      {mensaje && <MensajeModal data={mensaje} onClose={cerrarMensaje} />}
    </div>
  );
}