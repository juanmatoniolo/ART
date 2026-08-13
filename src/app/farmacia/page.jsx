"use client";
import { useState, useEffect } from "react";
import { ref, remove } from "firebase/database";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase";
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
  const router = useRouter();
  const [userRole, setUserRole] = useState(null);
  const [loadingLogout, setLoadingLogout] = useState(false);

  useEffect(() => {
    setUserRole("ADM Farmacia");
  }, []);

  const [activeTab, setActiveTab] = useState("dashboard");
  const [modal, setModal] = useState(null);
  const [theme, setTheme] = useState("light");

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const hook = useFarmacia();

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
    eliminarMovimiento: hookEliminarMovimiento,
  } = hook;

  // Log para ver cuántos items hay
  console.log("📦 Items en FarmaciaDashboard:", items?.length || 0);

  const handleCloseModal = () => setModal(null);
  const handleSubmitReparto = async (productos, datos) => {
    const ok = await procesarReparto(productos, datos);
    return ok;
  };

  const eliminarMovimiento = hookEliminarMovimiento || (async (id) => {
    try {
      await remove(ref(db, `movimientos/${id}`));
      alert("Movimiento eliminado (actualiza la página para ver cambios)");
      window.location.reload();
    } catch (error) {
      console.error("Error al eliminar:", error);
      alert("No se pudo eliminar el movimiento.");
    }
  });

  const handleLogout = async () => {
    if (loadingLogout) return;
    setLoadingLogout(true);
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      setLoadingLogout(false);
    }
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
            userRole={userRole}
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