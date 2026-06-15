"use client";
import { useState } from "react";
import useFarmacia from "./hooks/useFarmacia";
import StatsHeader from "./components/StatsHeader";
import TabNav from "./components/TabNav";
import DashboardTab from "./components/DashboardTab";
import StockTab from "./components/StockTab";
import MovimientosTab from "./components/MovimientosTab";
import ExportarTab from "./components/ExportarTab";
import MedyDescartablesPage from "@/components/medicacion/page";
import AgregarModal from "./components/modals/AgregarModal";
import CargaMasivaModal from "./components/modals/CargaMasivaModal";
import RepartoModal from "./components/modals/RepartoModal";
import ImportarExcelModal from "./components/modals/ImportarExcelModal";
import MensajeModal from "./components/modals/MensajeModal";
import s from "./farmaciaDashboard.module.css";
import ListasPreciosTab from "./components/ListasPreciosTab";


export default function FarmaciaDashboard() {
    const [activeTab, setActiveTab] = useState("dashboard");
    const [modal, setModal] = useState(null);



    const {
        items, movimientos, estadisticas, itemsBajoStockList,
        mensaje, cerrarMensaje,
        agregarProducto, cargarCatalogo,
        procesarCargaMasiva, procesarReparto,
        editarProducto, eliminarProducto,
        importarDesdeExcel, exportarDatos,
        listasPrecios, guardarListaPrecio, eliminarListaPrecio, exportarListasPrecios,
    } = useFarmacia();

    {
        activeTab === "precios" && (
            <ListasPreciosTab
                items={items}
                listas={listasPrecios}
                onGuardarLista={guardarListaPrecio}
                onEliminarLista={eliminarListaPrecio}
                onExportarListas={exportarListasPrecios}
            />
        )
    }

    return (
        <div className={s.dashboardContainer}>
            <StatsHeader
                estadisticas={estadisticas}
                onAgregar={() => setModal("agregar")}
                onCargaMasiva={() => setModal("masiva")}
                onReparto={() => setModal("reparto")}
                onExportar={() => setActiveTab("exportar")}
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
                    />
                )}
                {activeTab === "movimientos" && <MovimientosTab movimientos={movimientos} />}
                {activeTab === "catalogo" && <div className={s.panel}><MedyDescartablesPage /></div>}
                {activeTab === "exportar" && (
                    <ExportarTab
                        estadisticas={estadisticas}
                        movimientos={movimientos}
                        onExportar={(tipo) => exportarDatos({ tipo, incluirSinStock: true }, movimientos)}
                    />
                )}
            </main>

            {modal === "agregar" && <AgregarModal onClose={() => setModal(null)} onSubmit={agregarProducto} />}
            {modal === "masiva" && <CargaMasivaModal onClose={() => setModal(null)} onSubmit={procesarCargaMasiva} cargarCatalogo={cargarCatalogo} />}
            {modal === "reparto" && <RepartoModal onClose={() => setModal(null)} onSubmit={procesarReparto} items={items} />}
            {modal === "importar" && <ImportarExcelModal onClose={() => setModal(null)} onSubmit={importarDesdeExcel} />}
            {mensaje && <MensajeModal data={mensaje} onClose={cerrarMensaje} />}

        </div>
    );
}