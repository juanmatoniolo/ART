"use client";
import { useState } from "react";
import { ref, remove } from "firebase/database";
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
import RepartoModal from "./components/modals/RepartoModal";
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

  // Usuario fijo para el registro de movimientos
  const usuarioActual = {
    nombre: "Farmacia",      // Puedes cambiarlo por "Silvina" o lo que quieras
    rol: "ADM Farmacia",     // Para habilitar eliminar movimientos
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // Pasamos el usuario al hook
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
  const handleSubmitReparto = async (productos, datos) => {
    const ok = await procesarReparto(productos, datos);
    return ok;
  };

  // Función de logout (solo para el botón, sin auth real)
  const handleLogout = () => {
    // Puedes redirigir a una página de login simulada o simplemente recargar
    window.location.reload();
  };

  return (
    <div className={`${s.dashboardContainer} ${s[theme]}`}>
      <StatsHeader
        estadisticas={estadisticas}
        onAgregar={() => setModal("agregar")}
        onCargaMasiva={() => setModal("masiva")}
        onReparto={() => setModal("reparto")}
        onExportar={() => setActiveTab("exportar")}
        theme={theme}
        toggleTheme={toggleTheme}
        onLogout={handleLogout}
        loadingLogout={loadingLogout}
        usuario={usuarioActual.nombre}   // "Farmacia" o "Silvina"
        rol={usuarioActual.rol}          // "ADM Farmacia"
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

      {modal === "reparto" && (
        <RepartoModal
          onClose={handleCloseModal}
          onSubmit={handleSubmitReparto}
          items={items}
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