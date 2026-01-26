"use client";

import { useState, useEffect, useMemo } from "react";
import { ref, onValue, set, update, get, push } from "firebase/database";
import { db } from "@/lib/firebase";
import styles from "./farmaciaDashboard.module.css";

// Componente para mostrar medicación y descartables
import MedyDescartablesPage from "@/components/medicacion/page";

// Helper functions
const normalizeText = (input) =>
    String(input ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const matchesAllTerms = (texto, busqueda) => {
    const t = normalizeText(texto);
    const q = normalizeText(busqueda);
    if (!q) return true;
    const terms = q.split(" ").filter(Boolean);
    return terms.every((term) => t.includes(term));
};

// Función para formatear fecha
const formatFecha = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
};

// Función para obtener fecha legible
const getFechaLegible = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Hace unos segundos";
    if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    if (diffDays < 7) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
    
    return formatFecha(timestamp);
};

// Función para formatear moneda
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};

export default function FarmaciaDashboard() {
    const [activeTab, setActiveTab] = useState("dashboard");
    const [items, setItems] = useState([]);
    const [movimientos, setMovimientos] = useState([]);
    const [busqueda, setBusqueda] = useState("");
    const [filtroTipo, setFiltroTipo] = useState("todos");
    const [isMobile, setIsMobile] = useState(false);
    
    // Estados para agregar producto
    const [agregarModal, setAgregarModal] = useState(false);
    const [nuevoProducto, setNuevoProducto] = useState({
        nombre: "",
        tipo: "medicamento",
        presentacion: "ampolla",
        precio: "",
        stockActual: "0",
        stockMinimo: "10"
    });
    
    // Estados para carga masiva
    const [cargaMasivaModal, setCargaMasivaModal] = useState(false);
    const [productosCarga, setProductosCarga] = useState([]);
    const [catalogoBusqueda, setCatalogoBusqueda] = useState("");
    const [catalogoFiltrado, setCatalogoFiltrado] = useState([]);
    const [itemsCatalogo, setItemsCatalogo] = useState([]);
    const [usuarioActual, setUsuarioActual] = useState("Admin");
    
    // Estados para reparto
    const [repartoModal, setRepartoModal] = useState(false);
    const [productosReparto, setProductosReparto] = useState([]);
    const [busquedaReparto, setBusquedaReparto] = useState("");
    const [repartoData, setRepartoData] = useState({
        destino: "Guardia",
        responsable: "",
        nota: ""
    });

    // Verificar si es móvil
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

// Cargar datos de Firebase - VERSIÓN COMPLETAMENTE CORREGIDA
useEffect(() => {
    const cargarDatos = async () => {
        try {
            // Cargar items del inventario
            const refMeds = ref(db, "medydescartables/medicamentos");
            const refDesc = ref(db, "medydescartables/descartables");
            const refIngresos = ref(db, "ingresos_farmacia");
            const refRepartos = ref(db, "repartos_farmacia");

            // Cargar medicamentos y descartables
            const unsubMedsDesc = onValue(refMeds, (snapMeds) => {
                const medsData = snapMeds.exists() ? snapMeds.val() : {};
                
                const unsubDesc = onValue(refDesc, (snapDescLocal) => {
                    const descData = snapDescLocal.exists() ? snapDescLocal.val() : {};
                    const itemsArray = [];

                    // Procesar medicamentos
                    Object.entries(medsData).forEach(([key, itemData]) => {
                        itemsArray.push({
                            id: key,
                            nombre: itemData.nombre || key,
                            precio: itemData.precioReferencia || itemData.precio || 0,
                            presentacion: itemData.presentacion || "ampolla",
                            stockActual: itemData.stockActual || 0,
                            stockMinimo: itemData.stockMinimo || 10,
                            tipo: "medicamento",
                            activo: itemData.activo !== false
                        });
                    });

                    // Procesar descartables
                    Object.entries(descData).forEach(([key, itemData]) => {
                        itemsArray.push({
                            id: key,
                            nombre: itemData.nombre || key,
                            precio: itemData.precioReferencia || itemData.precio || 0,
                            presentacion: itemData.presentacion || "unidad",
                            stockActual: itemData.stockActual || 0,
                            stockMinimo: itemData.stockMinimo || 10,
                            tipo: "descartable",
                            activo: itemData.activo !== false
                        });
                    });

                    // Ordenar por nombre
                    itemsArray.sort((a, b) => a.nombre.localeCompare(b.nombre));
                    setItems(itemsArray);
                });

                return () => unsubDesc();
            });

            // Cargar movimientos (ingresos + repartos)
            const unsubMovimientos = onValue(refIngresos, (snapIngresosLocal) => {
                const ingresosData = snapIngresosLocal.exists() ? snapIngresosLocal.val() : {};
                
                const unsubRepartos = onValue(refRepartos, (snapRepartosLocal) => {
                    const repartosData = snapRepartosLocal.exists() ? snapRepartosLocal.val() : {};
                    
                    // Procesar ingresos
                    const ingresosArray = Object.entries(ingresosData)
                        .map(([key, ingreso]) => ({
                            id: key,
                            tipo: "ingreso",
                            ...ingreso,
                            fecha: ingreso.timestamp || key,
                            fechaFormatted: formatFecha(ingreso.timestamp || key),
                            fechaLegible: getFechaLegible(ingreso.timestamp || key),
                            icono: "📥"
                        }))
                        .filter(item => item.fecha);
                    
                    // Procesar repartos
                    const repartosArray = Object.entries(repartosData)
                        .map(([key, reparto]) => ({
                            id: key,
                            tipo: "reparto",
                            ...reparto,
                            fecha: reparto.timestamp || key,
                            fechaFormatted: formatFecha(reparto.timestamp || key),
                            fechaLegible: getFechaLegible(reparto.timestamp || key),
                            icono: "🚚"
                        }))
                        .filter(item => item.fecha);
                    
                    // Combinar y ordenar por fecha
                    const movimientosArray = [...ingresosArray, ...repartosArray]
                        .sort((a, b) => b.fecha - a.fecha)
                        .slice(0, 60);
                    
                    setMovimientos(movimientosArray);
                });

                return () => unsubRepartos();
            });

            return () => {
                unsubMedsDesc();
                unsubMovimientos();
            };
        } catch (error) {
            console.error("Error al cargar datos:", error);
        }
    };

    cargarDatos();
}, []);
    // Cargar catálogo completo para carga masiva
    useEffect(() => {
        if (cargaMasivaModal) {
            const cargarCatalogo = async () => {
                try {
                    const [snapMeds, snapDesc] = await Promise.all([
                        get(ref(db, "medydescartables/medicamentos")),
                        get(ref(db, "medydescartables/descartables"))
                    ]);

                    const catalogoItems = [];
                    
                    // Procesar medicamentos
                    if (snapMeds.exists()) {
                        Object.entries(snapMeds.val()).forEach(([key, item]) => {
                            catalogoItems.push({
                                id: key,
                                nombre: item.nombre || key,
                                precio: item.precioReferencia || item.precio || 0,
                                presentacion: item.presentacion || "ampolla",
                                tipo: "medicamento",
                                tipoLabel: "💊 Medicamento",
                                stockActual: item.stockActual || 0,
                                stockMinimo: item.stockMinimo || 10
                            });
                        });
                    }

                    // Procesar descartables
                    if (snapDesc.exists()) {
                        Object.entries(snapDesc.val()).forEach(([key, item]) => {
                            catalogoItems.push({
                                id: key,
                                nombre: item.nombre || key,
                                precio: item.precioReferencia || item.precio || 0,
                                presentacion: item.presentacion || "unidad",
                                tipo: "descartable",
                                tipoLabel: "🧷 Descartable",
                                stockActual: item.stockActual || 0,
                                stockMinimo: item.stockMinimo || 10
                            });
                        });
                    }

                    // Ordenar alfabéticamente
                    catalogoItems.sort((a, b) => a.nombre.localeCompare(b.nombre));
                    setItemsCatalogo(catalogoItems);
                    setCatalogoFiltrado(catalogoItems);
                } catch (error) {
                    console.error("Error al cargar catálogo:", error);
                }
            };

            cargarCatalogo();
        }
    }, [cargaMasivaModal]);

    // Filtrar catálogo para carga masiva
    useEffect(() => {
        if (catalogoBusqueda) {
            const filtered = itemsCatalogo.filter(item => 
                normalizeText(item.nombre).includes(normalizeText(catalogoBusqueda)) ||
                normalizeText(item.presentacion).includes(normalizeText(catalogoBusqueda)) ||
                normalizeText(item.tipoLabel).includes(normalizeText(catalogoBusqueda))
            );
            setCatalogoFiltrado(filtered);
        } else {
            setCatalogoFiltrado(itemsCatalogo);
        }
    }, [catalogoBusqueda, itemsCatalogo]);

    // Filtrar items según búsqueda y tipo
    const itemsFiltrados = useMemo(() => {
        return items.filter(item => {
            const matchBusqueda = matchesAllTerms(item.nombre, busqueda) || 
                                matchesAllTerms(item.presentacion, busqueda);
            const matchTipo = filtroTipo === "todos" || 
                            (filtroTipo === "medicamentos" && item.tipo === "medicamento") ||
                            (filtroTipo === "descartables" && item.tipo === "descartable");
            
            return matchBusqueda && matchTipo && item.activo;
        });
    }, [items, busqueda, filtroTipo]);

    // Calcular estadísticas
    const estadisticas = useMemo(() => {
        const totalItems = items.length;
        const itemsBajoStock = items.filter(item => item.stockActual < item.stockMinimo).length;
        const itemsSinStock = items.filter(item => item.stockActual === 0).length;
        const valorTotalStock = items.reduce((sum, item) => 
            sum + (item.stockActual * item.precio), 0
        );

        // Últimos 30 días
        const hace30Dias = new Date();
        hace30Dias.setDate(hace30Dias.getDate() - 30);
        
        const totalIngresos30Dias = movimientos
            .filter(mov => mov.fecha >= hace30Dias.getTime() && mov.tipo === "ingreso")
            .reduce((sum, mov) => 
                sum + (mov.productos?.reduce((subSum, prod) => subSum + prod.cantidad, 0) || 0), 0
            );

        const totalRepartos30Dias = movimientos
            .filter(mov => mov.fecha >= hace30Dias.getTime() && mov.tipo === "reparto")
            .reduce((sum, mov) => 
                sum + (mov.productos?.reduce((subSum, prod) => subSum + prod.cantidad, 0) || 0), 0
            );

        return {
            totalItems,
            itemsBajoStock,
            itemsSinStock,
            valorTotalStock,
            totalIngresos30Dias,
            totalRepartos30Dias
        };
    }, [items, movimientos]);

    // Items con stock bajo
    const itemsBajoStock = useMemo(() => {
        return items.filter(item => item.stockActual < item.stockMinimo && item.activo);
    }, [items]);

    // Get color based on stock level
    const getStockColor = (stockActual, stockMinimo) => {
        if (stockActual === 0) return "#ff4444";
        if (stockActual < stockMinimo) return "#ffaa00";
        if (stockActual < stockMinimo * 2) return "#00aaff";
        return "#00aa44";
    };

    // Get stock status text
    const getStockStatus = (stockActual, stockMinimo) => {
        if (stockActual === 0) return "Sin stock";
        if (stockActual < stockMinimo) return "Bajo stock";
        if (stockActual < stockMinimo * 2) return "Stock moderado";
        return "Stock óptimo";
    };

    // Validar que un número no sea negativo
    const validateNonNegative = (value, fieldName = "valor") => {
        const num = parseFloat(value);
        if (isNaN(num) || num < 0) {
            alert(`❌ El ${fieldName} no puede ser negativo`);
            return false;
        }
        return true;
    };

    // Agregar nuevo producto al inventario
    const agregarProducto = async () => {
        if (!nuevoProducto.nombre.trim() || !nuevoProducto.precio || parseFloat(nuevoProducto.precio) <= 0) {
            alert("Complete todos los campos requeridos");
            return;
        }

        // Validaciones
        if (!validateNonNegative(nuevoProducto.precio, "precio")) return;
        if (!validateNonNegative(nuevoProducto.stockActual, "stock actual")) return;
        if (!validateNonNegative(nuevoProducto.stockMinimo, "stock mínimo")) return;

        try {
            const key = nuevoProducto.nombre
                .replace(/[.#$/[\]]/g, "")
                .replace(/\s+/g, "_")
                .replace(/_+/g, "_")
                .replace(/^_+|_+$/g, "")
                .trim()
                .toUpperCase();

            const itemData = {
                nombre: nuevoProducto.nombre,
                tipo: nuevoProducto.tipo,
                presentacion: nuevoProducto.presentacion,
                precioReferencia: parseFloat(nuevoProducto.precio),
                stockActual: parseInt(nuevoProducto.stockActual) || 0,
                stockMinimo: parseInt(nuevoProducto.stockMinimo) || 10,
                activo: true
            };

            const path = `medydescartables/${nuevoProducto.tipo === "medicamento" ? "medicamentos" : "descartables"}/${key}`;
            
            await set(ref(db, path), itemData);

            // Registrar ingreso si hay stock inicial
            if (parseInt(nuevoProducto.stockActual) > 0) {
                const timestamp = Date.now();
                const ingresoId = `ingreso_${timestamp}`;
                
                const ingresoData = {
                    id: ingresoId,
                    timestamp: timestamp,
                    fecha: new Date(timestamp).toISOString(),
                    usuario: usuarioActual,
                    productos: [{
                        itemId: key,
                        itemNombre: nuevoProducto.nombre,
                        tipo: nuevoProducto.tipo === "medicamento" ? "medicamento" : "descartable",
                        presentacion: nuevoProducto.presentacion,
                        cantidad: parseInt(nuevoProducto.stockActual),
                        precioUnitario: parseFloat(nuevoProducto.precio),
                        stockAnterior: 0,
                        stockNuevo: parseInt(nuevoProducto.stockActual),
                        motivo: "Nuevo producto - Stock inicial"
                    }],
                    totalProductos: 1,
                    totalUnidades: parseInt(nuevoProducto.stockActual)
                };
                
                await set(ref(db, `ingresos_farmacia/${ingresoId}`), ingresoData);
            }

            // Limpiar formulario y cerrar modal
            setNuevoProducto({
                nombre: "",
                tipo: "medicamento",
                presentacion: "ampolla",
                precio: "",
                stockActual: "0",
                stockMinimo: "10"
            });
            setAgregarModal(false);
            
            alert("✅ Producto agregado exitosamente");
        } catch (error) {
            console.error("Error al agregar producto:", error);
            alert("❌ Error al agregar producto");
        }
    };

    // Agregar producto desde catálogo (carga masiva)
    const agregarDesdeCatalogo = (productoCatalogo) => {
        const yaExiste = productosCarga.find(p => p.id === productoCatalogo.id);
        if (!yaExiste) {
            setProductosCarga(prev => [...prev, {
                ...productoCatalogo,
                cantidad: "1",
                stockAnterior: productoCatalogo.stockActual || 0,
                stockNuevo: (productoCatalogo.stockActual || 0) + 1
            }]);
        }
    };

    // Quitar producto de la carga masiva
    const quitarDeCarga = (id) => {
        setProductosCarga(prev => prev.filter(p => p.id !== id));
    };

    // Actualizar cantidad en carga masiva
    const actualizarCantidadCarga = (id, nuevaCantidad) => {
        const cantidadNum = parseInt(nuevaCantidad) || 0;
        if (cantidadNum < 0) {
            alert("❌ La cantidad no puede ser negativa");
            return;
        }

        setProductosCarga(prev => prev.map(producto => {
            if (producto.id === id) {
                return {
                    ...producto,
                    cantidad: nuevaCantidad,
                    stockNuevo: (producto.stockAnterior || 0) + cantidadNum
                };
            }
            return producto;
        }));
    };

    // Procesar carga masiva
    const procesarCargaMasiva = async () => {
        if (productosCarga.length === 0) {
            alert("Agregue al menos un producto");
            return;
        }

        try {
            const timestamp = Date.now();
            const ingresoId = `ingreso_${timestamp}`;
            
            // Preparar productos para el ingreso
            const productosIngreso = [];
            const updates = {};
            let totalUnidades = 0;
            let valorTotal = 0;

            for (const producto of productosCarga) {
                const cantidad = parseInt(producto.cantidad) || 1;
                if (cantidad <= 0) continue;
                
                totalUnidades += cantidad;
                valorTotal += cantidad * producto.precio;
                
                // Datos del producto para el ingreso
                productosIngreso.push({
                    itemId: producto.id,
                    itemNombre: producto.nombre,
                    tipo: producto.tipo,
                    presentacion: producto.presentacion,
                    cantidad: cantidad,
                    precioUnitario: producto.precio,
                    stockAnterior: producto.stockAnterior || 0,
                    stockNuevo: (producto.stockAnterior || 0) + cantidad,
                    motivo: "Carga masiva"
                });

                // Actualizar stock del producto
                const path = `medydescartables/${producto.tipo === "medicamento" ? "medicamentos" : "descartables"}/${producto.id}`;
                updates[`${path}/stockActual`] = (producto.stockAnterior || 0) + cantidad;
            }

            // Datos del ingreso
            const ingresoData = {
                id: ingresoId,
                timestamp: timestamp,
                fecha: new Date(timestamp).toISOString(),
                usuario: usuarioActual,
                productos: productosIngreso,
                totalProductos: productosIngreso.length,
                totalUnidades: totalUnidades,
                valorTotal: valorTotal
            };

            // Agregar ingreso a los updates
            updates[`ingresos_farmacia/${ingresoId}`] = ingresoData;

            // Ejecutar todas las actualizaciones en una sola operación
            await update(ref(db), updates);

            // Limpiar y cerrar
            setProductosCarga([]);
            setCargaMasivaModal(false);
            
            alert(`✅ ${productosCarga.length} productos agregados exitosamente. Valor total: ${formatCurrency(valorTotal)}`);
        } catch (error) {
            console.error("Error en carga masiva:", error);
            alert("❌ Error al procesar carga masiva");
        }
    };

    // Agregar producto al reparto
    const agregarAlReparto = (producto) => {
        if (producto.stockActual <= 0) {
            alert("⚠️ Este producto no tiene stock disponible");
            return;
        }

        const yaExiste = productosReparto.find(p => p.id === producto.id);
        if (yaExiste) {
            alert("⚠️ Este producto ya está en la lista de reparto");
            return;
        }

        setProductosReparto(prev => [...prev, {
            ...producto,
            cantidadReparto: "1",
            stockAnterior: producto.stockActual,
            stockNuevo: producto.stockActual - 1
        }]);
        
        // Limpiar búsqueda después de agregar
        setBusquedaReparto("");
    };

    // Actualizar cantidad en reparto
    const actualizarCantidadReparto = (id, nuevaCantidad) => {
        const cantidadNum = parseInt(nuevaCantidad) || 0;
        const producto = productosReparto.find(p => p.id === id);
        
        if (!producto) return;
        
        if (cantidadNum < 0) {
            alert("❌ La cantidad no puede ser negativa");
            return;
        }
        
        if (cantidadNum > producto.stockAnterior) {
            alert(`❌ No puede repartir más de ${producto.stockAnterior} unidades (stock disponible)`);
            return;
        }

        setProductosReparto(prev => prev.map(p => {
            if (p.id === id) {
                return {
                    ...p,
                    cantidadReparto: nuevaCantidad,
                    stockNuevo: p.stockAnterior - cantidadNum
                };
            }
            return p;
        }));
    };

    // Quitar producto del reparto
    const quitarDelReparto = (id) => {
        setProductosReparto(prev => prev.filter(p => p.id !== id));
    };

    // Procesar reparto
    const procesarReparto = async () => {
        if (productosReparto.length === 0) {
            alert("Agregue al menos un producto para repartir");
            return;
        }

        if (!repartoData.responsable.trim()) {
            alert("Ingrese el nombre del responsable");
            return;
        }

        try {
            const timestamp = Date.now();
            const repartoId = `reparto_${timestamp}`;
            
            // Preparar productos para el reparto
            const productosRepartoData = [];
            const updates = {};
            let totalUnidades = 0;
            let valorTotal = 0;

            for (const producto of productosReparto) {
                const cantidad = parseInt(producto.cantidadReparto) || 0;
                if (cantidad <= 0) continue;
                
                totalUnidades += cantidad;
                valorTotal += cantidad * producto.precio;
                
                // Datos del producto para el reparto
                productosRepartoData.push({
                    itemId: producto.id,
                    itemNombre: producto.nombre,
                    tipo: producto.tipo,
                    presentacion: producto.presentacion,
                    cantidad: cantidad,
                    precioUnitario: producto.precio,
                    stockAnterior: producto.stockAnterior,
                    stockNuevo: producto.stockNuevo,
                    motivo: `Reparto a ${repartoData.destino}`
                });

                // Actualizar stock del producto (restar)
                const path = `medydescartables/${producto.tipo === "medicamento" ? "medicamentos" : "descartables"}/${producto.id}`;
                updates[`${path}/stockActual`] = producto.stockNuevo;
            }

            // Datos del reparto
            const repartoDataObj = {
                id: repartoId,
                timestamp: timestamp,
                fecha: new Date(timestamp).toISOString(),
                usuario: usuarioActual,
                destino: repartoData.destino,
                responsable: repartoData.responsable,
                nota: repartoData.nota || "Sin observaciones",
                productos: productosRepartoData,
                totalProductos: productosRepartoData.length,
                totalUnidades: totalUnidades,
                valorTotal: valorTotal
            };

            // Agregar reparto a los updates
            updates[`repartos_farmacia/${repartoId}`] = repartoDataObj;

            // Ejecutar todas las actualizaciones en una sola operación
            await update(ref(db), updates);

            // Limpiar y cerrar
            setProductosReparto([]);
            setRepartoData({
                destino: "Guardia",
                responsable: "",
                nota: ""
            });
            setBusquedaReparto("");
            setRepartoModal(false);
            
            alert(`✅ Reparto registrado exitosamente. ${totalUnidades} unidades repartidas. Valor: ${formatCurrency(valorTotal)}`);
        } catch (error) {
            console.error("Error en reparto:", error);
            alert("❌ Error al procesar reparto");
        }
    };

    // Calcular totales de reparto
    const totalesReparto = useMemo(() => {
        return productosReparto.reduce((acc, producto) => {
            const cantidad = parseInt(producto.cantidadReparto) || 0;
            return {
                unidades: acc.unidades + cantidad,
                valor: acc.valor + (cantidad * producto.precio)
            };
        }, { unidades: 0, valor: 0 });
    }, [productosReparto]);

    // Calcular totales de carga masiva
    const totalesCarga = useMemo(() => {
        return productosCarga.reduce((acc, producto) => {
            const cantidad = parseInt(producto.cantidad) || 0;
            return {
                unidades: acc.unidades + cantidad,
                valor: acc.valor + (cantidad * producto.precio)
            };
        }, { unidades: 0, valor: 0 });
    }, [productosCarga]);

    return (
        <div className={styles.dashboardContainer}>
            {/* Header con estadísticas */}
            <header className={styles.dashboardHeader}>
                <div className={styles.headerContent}>
                    <h1 className={styles.dashboardTitle}>
                        <span className={styles.titleIcon}>🏥</span>
                        Dashboard de Farmacia
                    </h1>
                    
                    <div className={styles.headerStats}>
                        <div className={styles.statItem}>
                            <span className={styles.statIcon}>📦</span>
                            <div>
                                <div className={styles.statValue}>{estadisticas.totalItems}</div>
                                <div className={styles.statLabel}>Productos</div>
                            </div>
                        </div>
                        
                        <div className={styles.statItem}>
                            <span className={styles.statIcon} style={{color: estadisticas.itemsBajoStock > 0 ? '#ff6b35' : '#27ae60'}}>⚠️</span>
                            <div>
                                <div className={styles.statValue} style={{color: estadisticas.itemsBajoStock > 0 ? '#ff6b35' : '#27ae60'}}>
                                    {estadisticas.itemsBajoStock}
                                </div>
                                <div className={styles.statLabel}>Bajo stock</div>
                            </div>
                        </div>
                        
                        <div className={styles.statItem}>
                            <span className={styles.statIcon}>💰</span>
                            <div>
                                <div className={styles.statValue}>{formatCurrency(estadisticas.valorTotalStock)}</div>
                                <div className={styles.statLabel}>Valor total</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className={styles.headerActions}>
                    <button 
                        className={`${styles.actionButton} ${styles.primaryButton}`}
                        onClick={() => setAgregarModal(true)}
                    >
                        <span className={styles.buttonIcon}>➕</span>
                        Nuevo Producto
                    </button>
                    <button 
                        className={`${styles.actionButton} ${styles.secondaryButton}`}
                        onClick={() => setCargaMasivaModal(true)}
                    >
                        <span className={styles.buttonIcon}>📥</span>
                        Carga Masiva
                    </button>
                    <button 
                        className={`${styles.actionButton} ${styles.dangerButton}`}
                        onClick={() => setRepartoModal(true)}
                    >
                        <span className={styles.buttonIcon}>🚚</span>
                        Repartir
                    </button>
                </div>
            </header>
            
            {/* Navegación por tabs */}
            <nav className={styles.mainNav}>
                <div className={styles.tabsContainer}>
                    <button 
                        className={`${styles.tabButton} ${activeTab === "dashboard" ? styles.activeTab : ""}`}
                        onClick={() => setActiveTab("dashboard")}
                    >
                        <span className={styles.tabIcon}>📊</span>
                        <span className={styles.tabText}>Dashboard</span>
                    </button>
                    <button 
                        className={`${styles.tabButton} ${activeTab === "stock" ? styles.activeTab : ""}`}
                        onClick={() => setActiveTab("stock")}
                    >
                        <span className={styles.tabIcon}>📦</span>
                        <span className={styles.tabText}>Control de Stock</span>
                    </button>
                    <button 
                        className={`${styles.tabButton} ${activeTab === "movimientos" ? styles.activeTab : ""}`}
                        onClick={() => setActiveTab("movimientos")}
                    >
                        <span className={styles.tabIcon}>📋</span>
                        <span className={styles.tabText}>Movimientos</span>
                    </button>
                    <button 
                        className={`${styles.tabButton} ${activeTab === "catalogo" ? styles.activeTab : ""}`}
                        onClick={() => setActiveTab("catalogo")}
                    >
                        <span className={styles.tabIcon}>💊</span>
                        <span className={styles.tabText}>Catálogo</span>
                    </button>
                </div>
            </nav>

            {/* Contenido según tab activo */}
            <main className={styles.mainContent}>
                {activeTab === "dashboard" && (
                    <div className={styles.dashboardGrid}>
                        {/* Cards de estadísticas */}
                        <div className={styles.statsGrid}>
                            <div className={styles.statCard}>
                                <div className={styles.statCardHeader}>
                                    <span className={styles.statCardIcon}>📦</span>
                                    <h3>Total de Productos</h3>
                                </div>
                                <div className={styles.statCardValue}>{estadisticas.totalItems}</div>
                                <div className={styles.statCardLabel}>Items activos en inventario</div>
                            </div>
                            
                            <div className={`${styles.statCard} ${styles.warningCard}`}>
                                <div className={styles.statCardHeader}>
                                    <span className={styles.statCardIcon}>⚠️</span>
                                    <h3>Stock Bajo</h3>
                                </div>
                                <div className={styles.statCardValue}>{estadisticas.itemsBajoStock}</div>
                                <div className={styles.statCardLabel}>Requieren atención</div>
                            </div>
                            
                            <div className={`${styles.statCard} ${styles.dangerCard}`}>
                                <div className={styles.statCardHeader}>
                                    <span className={styles.statCardIcon}>❌</span>
                                    <h3>Sin Stock</h3>
                                </div>
                                <div className={styles.statCardValue}>{estadisticas.itemsSinStock}</div>
                                <div className={styles.statCardLabel}>Urgente reabastecer</div>
                            </div>
                            
                            <div className={`${styles.statCard} ${styles.successCard}`}>
                                <div className={styles.statCardHeader}>
                                    <span className={styles.statCardIcon}>💰</span>
                                    <h3>Valor Total Stock</h3>
                                </div>
                                <div className={styles.statCardValue}>{formatCurrency(estadisticas.valorTotalStock)}</div>
                                <div className={styles.statCardLabel}>Valor en inventario</div>
                            </div>
                        </div>

                        {/* Alertas de stock bajo */}
                        <div className={styles.alertSection}>
                            <div className={styles.sectionHeader}>
                                <h3 className={styles.sectionTitle}>
                                    <span className={styles.sectionIcon}>⚠️</span>
                                    Alertas de Stock Bajo
                                </h3>
                                {itemsBajoStock.length > 0 && (
                                    <span className={styles.alertCount}>{itemsBajoStock.length}</span>
                                )}
                            </div>
                            {itemsBajoStock.length === 0 ? (
                                <div className={styles.noAlerts}>
                                    <span className={styles.noAlertsIcon}>✅</span>
                                    <p>Todo el stock está en niveles óptimos</p>
                                </div>
                            ) : (
                                <div className={styles.alertList}>
                                    {itemsBajoStock.slice(0, 6).map(item => (
                                        <div key={item.id} className={styles.alertItem}>
                                            <div className={styles.alertItemIcon}>
                                                {item.tipo === "medicamento" ? "💊" : "🧷"}
                                            </div>
                                            <div className={styles.alertItemContent}>
                                                <div className={styles.alertItemTitle}>
                                                    {item.nombre.replace(/_/g, " ")}
                                                </div>
                                                <div className={styles.alertItemDetails}>
                                                    <span className={styles.alertItemType}>
                                                        {item.tipo === "medicamento" ? "Medicamento" : "Descartable"}
                                                    </span>
                                                    <span className={styles.alertItemPresentacion}>
                                                        {item.presentacion}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className={styles.alertItemStock}>
                                                <div className={styles.stockIndicator}>
                                                    <div 
                                                        className={styles.stockBar}
                                                        style={{
                                                            width: `${Math.min(100, (item.stockActual / item.stockMinimo) * 100)}%`,
                                                            backgroundColor: getStockColor(item.stockActual, item.stockMinimo)
                                                        }}
                                                    ></div>
                                                </div>
                                                <div className={styles.stockNumbers}>
                                                    <span className={styles.stockCurrent} style={{color: getStockColor(item.stockActual, item.stockMinimo)}}>
                                                        {item.stockActual}
                                                    </span>
                                                    <span className={styles.stockMin}> / {item.stockMinimo}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Últimos movimientos */}
                        <div className={styles.recentMovements}>
                            <div className={styles.sectionHeader}>
                                <h3 className={styles.sectionTitle}>
                                    <span className={styles.sectionIcon}>📋</span>
                                    Últimos Movimientos
                                </h3>
                            </div>
                            {movimientos.slice(0, 5).map(movimiento => (
                                <div key={movimiento.id} className={styles.movementItem}>
                                    <div className={styles.movementHeader}>
                                        <div className={styles.movementTitle}>
                                            <span className={`${styles.movimientoBadge} ${
                                                movimiento.tipo === "ingreso" ? styles.ingresoBadge : styles.repartoBadge
                                            }`}>
                                                {movimiento.tipo === "ingreso" ? "📥 INGRESO" : "🚚 REPARTO"}
                                            </span>
                                            <span className={styles.movementUser}>👤 {movimiento.usuario}</span>
                                            {movimiento.tipo === "reparto" && (
                                                <span className={styles.destinoMini}>📍 {movimiento.destino}</span>
                                            )}
                                        </div>
                                        <span className={styles.movementDate}>
                                            {movimiento.fechaLegible}
                                        </span>
                                    </div>
                                    <div className={styles.movementStats}>
                                        <div className={styles.movementStat}>
                                            <span className={styles.statIcon}>📋</span>
                                            <span>{movimiento.totalProductos || movimiento.productos?.length || 0} productos</span>
                                        </div>
                                        <div className={styles.movementStat}>
                                            <span className={styles.statIcon}>📦</span>
                                            <span>{movimiento.totalUnidades || movimiento.productos?.reduce((sum, prod) => sum + prod.cantidad, 0) || 0} unidades</span>
                                        </div>
                                        <div className={styles.movementStat}>
                                            <span className={styles.statIcon}>💰</span>
                                            <span>
                                                {formatCurrency(movimiento.valorTotal || 
                                                    movimiento.productos?.reduce((sum, prod) => 
                                                        sum + (prod.cantidad * prod.precioUnitario), 0) || 0)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className={styles.productosList}>
                                        <div className={styles.productosGrid}>
                                            {movimiento.productos?.slice(0, 3).map((prod, idx) => (
                                                <span key={idx} className={styles.productoTag}>
                                                    <span className={styles.productoName}>
                                                        {prod.itemNombre.replace(/_/g, " ")}
                                                    </span>
                                                    <span className={`${styles.productoCantidad} ${
                                                        movimiento.tipo === "ingreso" ? styles.cantidadPositiva : styles.cantidadNegativa
                                                    }`}>
                                                        {movimiento.tipo === "ingreso" ? '+' : '-'}{prod.cantidad}
                                                    </span>
                                                </span>
                                            ))}
                                            {movimiento.productos?.length > 3 && (
                                                <span className={styles.moreProducts}>
                                                    +{movimiento.productos.length - 3} más
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === "stock" && (
                    <div className={styles.stockControl}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.headerTitle}>
                                <h3 className={styles.sectionTitle}>
                                    <span className={styles.sectionIcon}>📦</span>
                                    Control de Stock
                                </h3>
                                <span className={styles.stockCount}>
                                    {itemsFiltrados.length} productos • Valor total: {formatCurrency(estadisticas.valorTotalStock)}
                                </span>
                            </div>
                            
                            <div className={styles.quickActions}>
                                <button 
                                    className={`${styles.actionButton} ${styles.primaryButton}`}
                                    onClick={() => setAgregarModal(true)}
                                >
                                    <span className={styles.buttonIcon}>➕</span>
                                    Agregar
                                </button>
                                <button 
                                    className={`${styles.actionButton} ${styles.secondaryButton}`}
                                    onClick={() => setCargaMasivaModal(true)}
                                >
                                    <span className={styles.buttonIcon}>📥</span>
                                    Carga Masiva
                                </button>
                            </div>
                        </div>

                        <div className={styles.filters}>
                            <div className={styles.searchContainer}>
                                <input
                                    type="text"
                                    className={styles.searchInput}
                                    placeholder="Buscar producto..."
                                    value={busqueda}
                                    onChange={(e) => setBusqueda(e.target.value)}
                                />
                                <span className={styles.searchIcon}>🔍</span>
                            </div>
                            <select
                                className={styles.filterSelect}
                                value={filtroTipo}
                                onChange={(e) => setFiltroTipo(e.target.value)}
                            >
                                <option value="todos">Todos los tipos</option>
                                <option value="medicamentos">💊 Medicamentos</option>
                                <option value="descartables">🧷 Descartables</option>
                            </select>
                        </div>

                        {/* Tabla de stock */}
                        <div className={styles.stockTableContainer}>
                            <table className={styles.stockTable}>
                                <thead>
                                    <tr>
                                        <th>Producto</th>
                                        <th>Tipo</th>
                                        <th>Presentación</th>
                                        <th>Stock Actual</th>
                                        <th>Stock Mínimo</th>
                                        <th>Estado</th>
                                        <th>Valor Stock</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {itemsFiltrados.map(item => (
                                        <tr key={item.id} className={styles.stockRow}>
                                            <td>
                                                <div className={styles.productCell}>
                                                    <span className={styles.productIcon}>
                                                        {item.tipo === "medicamento" ? "💊" : "🧷"}
                                                    </span>
                                                    <div className={styles.productInfo}>
                                                        <strong className={styles.productName}>
                                                            {item.nombre.replace(/_/g, " ")}
                                                        </strong>
                                                        <small className={styles.productPrice}>
                                                            {formatCurrency(item.precio)} c/u
                                                        </small>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={item.tipo === "medicamento" ? styles.medBadge : styles.descBadge}>
                                                    {item.tipo === "medicamento" ? "Medicamento" : "Descartable"}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={styles.presentacionBadge}>
                                                    {item.presentacion}
                                                </span>
                                            </td>
                                            <td>
                                                <span 
                                                    className={styles.stockValue}
                                                    style={{color: getStockColor(item.stockActual, item.stockMinimo)}}
                                                >
                                                    {item.stockActual}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={styles.stockMin}>{item.stockMinimo}</span>
                                            </td>
                                            <td>
                                                <span 
                                                    className={styles.statusBadge}
                                                    style={{backgroundColor: getStockColor(item.stockActual, item.stockMinimo)}}
                                                >
                                                    {getStockStatus(item.stockActual, item.stockMinimo)}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={styles.valueCell}>
                                                    {formatCurrency(item.stockActual * item.precio)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {itemsFiltrados.length === 0 && (
                                <div className={styles.noResults}>
                                    <span className={styles.noResultsIcon}>📭</span>
                                    <p>No se encontraron productos</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === "movimientos" && (
                    <div className={styles.movimientosHistory}>
                        <div className={styles.sectionHeader}>
                            <h3 className={styles.sectionTitle}>
                                <span className={styles.sectionIcon}>📋</span>
                                Historial de Movimientos
                            </h3>
                            <span className={styles.movimientosCount}>
                                {movimientos.length} registros
                            </span>
                        </div>
                        
                        <div className={styles.movimientosList}>
                            {movimientos.length === 0 ? (
                                <div className={styles.noMovimientos}>
                                    <span className={styles.noMovimientosIcon}>📭</span>
                                    <p>No hay movimientos registrados</p>
                                </div>
                            ) : (
                                movimientos.map(movimiento => (
                                    <div key={movimiento.id} className={styles.movimientoCard}>
                                        <div className={styles.movimientoHeader}>
                                            <div className={styles.movimientoTitle}>
                                                <div className={styles.movimientoTipo}>
                                                    <span className={`${styles.tipoBadge} ${
                                                        movimiento.tipo === "ingreso" ? styles.ingresoBadge : styles.repartoBadge
                                                    }`}>
                                                        <span className={styles.tipoIcon}>{movimiento.icono}</span>
                                                        {movimiento.tipo === "ingreso" ? "INGRESO" : "REPARTO"}
                                                    </span>
                                                    {movimiento.tipo === "reparto" && (
                                                        <span className={styles.destinoBadge}>
                                                            📍 {movimiento.destino}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className={styles.movimientoFecha}>
                                                    {movimiento.fechaFormatted}
                                                </span>
                                            </div>
                                            <div className={styles.movimientoStats}>
                                                <span className={styles.movimientoUsuario}>
                                                    👤 {movimiento.usuario}
                                                </span>
                                                <span className={styles.movimientoTotal}>
                                                    📦 {movimiento.totalUnidades || movimiento.productos?.reduce((sum, prod) => sum + prod.cantidad, 0) || 0} unidades
                                                </span>
                                                <span className={styles.movimientoProductos}>
                                                    📋 {movimiento.totalProductos || movimiento.productos?.length || 0} productos
                                                </span>
                                                <span className={styles.movimientoValor}>
                                                    💰 {formatCurrency(movimiento.valorTotal || 
                                                        movimiento.productos?.reduce((sum, prod) => 
                                                            sum + (prod.cantidad * prod.precioUnitario), 0) || 0)}
                                                </span>
                                                {movimiento.tipo === "reparto" && (
                                                    <span className={styles.responsableBadge}>
                                                        👤 {movimiento.responsable}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className={styles.movimientoProductosList}>
                                            <h4 className={styles.productosTitle}>
                                                {movimiento.tipo === "ingreso" ? "Productos ingresados:" : "Productos repartidos:"}
                                            </h4>
                                            <div className={styles.productosTable}>
                                                <table>
                                                    <thead>
                                                        <tr>
                                                            <th>Producto</th>
                                                            <th>Tipo</th>
                                                            <th>Presentación</th>
                                                            <th>Cantidad</th>
                                                            <th>Stock Anterior</th>
                                                            <th>Stock Nuevo</th>
                                                            <th>Valor Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {movimiento.productos?.map((prod, idx) => (
                                                            <tr key={idx} className={styles.productoRow}>
                                                                <td>{prod.itemNombre.replace(/_/g, " ")}</td>
                                                                <td>
                                                                    <span className={prod.tipo === "medicamento" ? styles.medSmallBadge : styles.descSmallBadge}>
                                                                        {prod.tipo === "medicamento" ? "Medicamento" : "Descartable"}
                                                                    </span>
                                                                </td>
                                                                <td>{prod.presentacion}</td>
                                                                <td className={styles.cantidadCell}>
                                                                    <span className={`${styles.cantidad} ${
                                                                        movimiento.tipo === "ingreso" ? styles.cantidadPositiva : styles.cantidadNegativa
                                                                    }`}>
                                                                        {movimiento.tipo === "ingreso" ? '+' : '-'}{prod.cantidad}
                                                                    </span>
                                                                </td>
                                                                <td>{prod.stockAnterior}</td>
                                                                <td>
                                                                    <span className={styles.stockNuevo}>
                                                                        {prod.stockNuevo}
                                                                    </span>
                                                                </td>
                                                                <td className={styles.valorCell}>
                                                                    {formatCurrency(prod.cantidad * prod.precioUnitario)}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {activeTab === "catalogo" && (
                    <div className={styles.catalogSection}>
                        <MedyDescartablesPage />
                    </div>
                )}
            </main>

            {/* Modal para agregar producto */}
            {agregarModal && (
                <div className={styles.modalOverlay} onClick={() => setAgregarModal(false)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3 className={styles.modalTitle}>
                                <span className={styles.modalIcon}>➕</span>
                                Agregar Nuevo Producto
                            </h3>
                            <button 
                                className={styles.closeButton}
                                onClick={() => setAgregarModal(false)}
                            >
                                ✕
                            </button>
                        </div>
                        
                        <div className={styles.modalBody}>
                            <div className={styles.formGrid}>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>
                                        <span className={styles.labelIcon}>📝</span>
                                        Nombre del Producto *
                                    </label>
                                    <input
                                        type="text"
                                        className={styles.formInput}
                                        value={nuevoProducto.nombre}
                                        onChange={(e) => setNuevoProducto({...nuevoProducto, nombre: e.target.value})}
                                        placeholder="Ej: Paracetamol 500mg"
                                        required
                                    />
                                </div>
                                
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>
                                        <span className={styles.labelIcon}>🏷️</span>
                                        Tipo
                                    </label>
                                    <select
                                        className={styles.formSelect}
                                        value={nuevoProducto.tipo}
                                        onChange={(e) => setNuevoProducto({...nuevoProducto, tipo: e.target.value})}
                                    >
                                        <option value="medicamento">💊 Medicamento</option>
                                        <option value="descartable">🧷 Descartable</option>
                                    </select>
                                </div>
                                
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>
                                        <span className={styles.labelIcon}>📦</span>
                                        Presentación
                                    </label>
                                    <select
                                        className={styles.formSelect}
                                        value={nuevoProducto.presentacion}
                                        onChange={(e) => setNuevoProducto({...nuevoProducto, presentacion: e.target.value})}
                                    >
                                        {nuevoProducto.tipo === "medicamento" ? (
                                            <>
                                                <option value="ampolla">Ampolla</option>
                                                <option value="vial">Vial</option>
                                                <option value="tabletas">Tabletas</option>
                                                <option value="frasco">Frasco</option>
                                                <option value="bolsa">Bolsa</option>
                                                <option value="jeringa">Jeringa</option>
                                                <option value="gasas">Gasas</option>
                                                <option value="tubo">Tubo</option>
                                                <option value="tiras">Tiras</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value="unidad">Unidad</option>
                                                <option value="rollo">Rollo</option>
                                                <option value="juego">Juego</option>
                                                <option value="bolsa">Bolsa</option>
                                                <option value="frasco">Frasco</option>
                                                <option value="kit">Kit</option>
                                                <option value="set">Set</option>
                                                <option value="tubo">Tubo</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                                
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>
                                        <span className={styles.labelIcon}>💰</span>
                                        Precio Unitario ($) *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className={styles.formInput}
                                        value={nuevoProducto.precio}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (parseFloat(value) < 0) {
                                                alert("❌ El precio no puede ser negativo");
                                                return;
                                            }
                                            setNuevoProducto({...nuevoProducto, precio: value});
                                        }}
                                        placeholder="0.00"
                                        min="0"
                                        required
                                    />
                                </div>
                                
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>
                                        <span className={styles.labelIcon}>📊</span>
                                        Stock Inicial
                                    </label>
                                    <input
                                        type="number"
                                        className={styles.formInput}
                                        value={nuevoProducto.stockActual}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (parseInt(value) < 0) {
                                                alert("❌ El stock no puede ser negativo");
                                                return;
                                            }
                                            setNuevoProducto({...nuevoProducto, stockActual: value});
                                        }}
                                        placeholder="0"
                                        min="0"
                                    />
                                </div>
                                
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>
                                        <span className={styles.labelIcon}>⚠️</span>
                                        Stock Mínimo *
                                    </label>
                                    <input
                                        type="number"
                                        className={styles.formInput}
                                        value={nuevoProducto.stockMinimo}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (parseInt(value) < 1) {
                                                alert("❌ El stock mínimo debe ser al menos 1");
                                                return;
                                            }
                                            setNuevoProducto({...nuevoProducto, stockMinimo: value});
                                        }}
                                        placeholder="10"
                                        min="1"
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                        
                        <div className={styles.modalFooter}>
                            <button 
                                className={styles.cancelButton}
                                onClick={() => setAgregarModal(false)}
                            >
                                Cancelar
                            </button>
                            <button 
                                className={styles.submitButton}
                                onClick={agregarProducto}
                            >
                                Agregar Producto
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal para carga masiva */}
            {cargaMasivaModal && (
                <div className={styles.modalOverlay} onClick={() => {
                    setCargaMasivaModal(false);
                    setProductosCarga([]);
                }}>
                    <div className={`${styles.modalContent} ${styles.largeModal}`} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3 className={styles.modalTitle}>
                                <span className={styles.modalIcon}>📥</span>
                                Carga Masiva de Productos
                            </h3>
                            <button 
                                className={styles.closeButton}
                                onClick={() => {
                                    setCargaMasivaModal(false);
                                    setProductosCarga([]);
                                }}
                            >
                                ✕
                            </button>
                        </div>
                        
                        <div className={`${styles.modalBody} ${styles.largeBody}`}>
                            <div className={styles.cargaMasivaGrid}>
                                {/* Panel izquierdo: Búsqueda en catálogo */}
                                <div className={styles.catalogoPanel}>
                                    <h4 className={styles.panelTitle}>
                                        <span className={styles.panelIcon}>🔍</span>
                                        Buscar en Catálogo
                                    </h4>
                                    <div className={styles.searchContainer}>
                                        <input
                                            type="text"
                                            className={styles.searchInput}
                                            placeholder="Buscar productos..."
                                            value={catalogoBusqueda}
                                            onChange={(e) => setCatalogoBusqueda(e.target.value)}
                                        />
                                        <span className={styles.searchIcon}>🔍</span>
                                    </div>
                                    
                                    <div className={styles.catalogoList}>
                                        {catalogoFiltrado.slice(0, 60).map(item => (
                                            <div 
                                                key={item.id} 
                                                className={styles.catalogoItem}
                                                onClick={() => agregarDesdeCatalogo(item)}
                                            >
                                                <div className={styles.catalogoItemHeader}>
                                                    <div className={styles.catalogoItemInfo}>
                                                        <strong className={styles.catalogoItemName}>
                                                            {item.nombre.replace(/_/g, " ")}
                                                        </strong>
                                                        <span className={item.tipo === "medicamento" ? styles.medSmallBadge : styles.descSmallBadge}>
                                                            {item.tipoLabel}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className={styles.catalogoItemDetails}>
                                                    <span className={styles.presentacionSmall}>
                                                        {item.presentacion}
                                                    </span>
                                                    <span className={styles.precioSmall}>
                                                        {formatCurrency(item.precio)}
                                                    </span>
                                                </div>
                                                <div className={styles.catalogoItemStock}>
                                                    <span className={styles.stockLabel}>Stock actual:</span>
                                                    <span className={styles.stockValue}>{item.stockActual || 0}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                
                                {/* Panel derecho: Productos seleccionados */}
                                <div className={styles.cargaPanel}>
                                    <div className={styles.panelHeader}>
                                        <h4 className={styles.panelTitle}>
                                            <span className={styles.panelIcon}>📦</span>
                                            Productos a Cargar ({productosCarga.length})
                                        </h4>
                                        <div className={styles.panelTotal}>
                                            <span className={styles.totalLabel}>Total:</span>
                                            <span className={styles.totalValue}>{totalesCarga.unidades} unidades</span>
                                            <span className={styles.totalValue}>{formatCurrency(totalesCarga.valor)}</span>
                                        </div>
                                    </div>
                                    
                                    {productosCarga.length === 0 ? (
                                        <div className={styles.noProductsMessage}>
                                            <span className={styles.noProductsIcon}>📦</span>
                                            <p>Seleccione productos del catálogo para agregarlos</p>
                                            <small>Los productos se agregarán en un solo ingreso</small>
                                        </div>
                                    ) : (
                                        <div className={styles.cargaList}>
                                            {productosCarga.map((producto, index) => (
                                                <div key={producto.id} className={styles.cargaItem}>
                                                    <div className={styles.cargaItemHeader}>
                                                        <div className={styles.cargaItemInfo}>
                                                            <strong className={styles.cargaItemName}>
                                                                {producto.nombre.replace(/_/g, " ")}
                                                            </strong>
                                                            <button 
                                                                className={styles.removeButton}
                                                                onClick={() => quitarDeCarga(producto.id)}
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                        <div className={styles.cargaItemDetails}>
                                                            <span className={styles.cargaTipo}>
                                                                {producto.tipoLabel}
                                                            </span>
                                                            <span className={styles.cargaPresentacion}>
                                                                {producto.presentacion}
                                                            </span>
                                                            <span className={styles.cargaPrecio}>
                                                                {formatCurrency(producto.precio)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className={styles.cargaItemStock}>
                                                        <div className={styles.stockInfo}>
                                                            <span>Stock actual: {producto.stockAnterior || 0}</span>
                                                            <span className={styles.arrowIcon}>→</span>
                                                            <span>Nuevo stock: {producto.stockNuevo || producto.stockAnterior || 0}</span>
                                                        </div>
                                                    </div>
                                                    <div className={styles.cargaControls}>
                                                        <div className={styles.cargaControlGroup}>
                                                            <label className={styles.controlLabel}>
                                                                <span className={styles.labelIcon}>➕</span>
                                                                Cantidad a agregar:
                                                            </label>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                className={styles.cantidadInput}
                                                                value={producto.cantidad}
                                                                onChange={(e) => actualizarCantidadCarga(producto.id, e.target.value)}
                                                                placeholder="Cantidad"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        <div className={styles.modalFooter}>
                            <div className={styles.footerTotal}>
                                <span className={styles.totalLabel}>Total a cargar:</span>
                                <div className={styles.totalAmount}>
                                    <span className={styles.totalUnits}>{totalesCarga.unidades} unidades</span>
                                    <span className={styles.totalMoney}>{formatCurrency(totalesCarga.valor)}</span>
                                </div>
                            </div>
                            <div className={styles.footerActions}>
                                <button 
                                    className={styles.cancelButton}
                                    onClick={() => {
                                        setCargaMasivaModal(false);
                                        setProductosCarga([]);
                                    }}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    className={styles.submitButton}
                                    onClick={procesarCargaMasiva}
                                    disabled={productosCarga.length === 0}
                                >
                                    Procesar Ingreso ({productosCarga.length} productos)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal para reparto */}
            {repartoModal && (
                <div className={styles.modalOverlay} onClick={() => {
                    setRepartoModal(false);
                    setProductosReparto([]);
                    setRepartoData({ destino: "Guardia", responsable: "", nota: "" });
                    setBusquedaReparto("");
                }}>
                    <div className={`${styles.modalContent} ${styles.largeModal}`} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader} style={{background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)'}}>
                            <h3 className={styles.modalTitle} style={{color: 'white'}}>
                                <span className={styles.modalIcon}>🚚</span>
                                Registrar Despacho
                            </h3>
                            <button 
                                className={styles.closeButton}
                                style={{color: 'white'}}
                                onClick={() => {
                                    setRepartoModal(false);
                                    setProductosReparto([]);
                                    setRepartoData({ destino: "Guardia", responsable: "", nota: "" });
                                    setBusquedaReparto("");
                                }}
                            >
                                ✕
                            </button>
                        </div>
                        
                        <div className={`${styles.modalBody} ${styles.largeBody}`}>
                            <div className={styles.cargaMasivaGrid}>
                                {/* Panel izquierdo: Datos del reparto */}
                                <div className={styles.catalogoPanel}>
                                    <h4 className={styles.panelTitle}>
                                        <span className={styles.panelIcon}>📋</span>
                                        Datos del Despacho
                                    </h4>
                                    
                                    <div className={styles.formGroup}>
                                        <label className={styles.formLabel}>
                                            <span className={styles.labelIcon}>📍</span>
                                            Destino *
                                        </label>
                                        <select
                                            className={styles.formSelect}
                                            value={repartoData.destino}
                                            onChange={(e) => setRepartoData({...repartoData, destino: e.target.value})}
                                        >
                                            <option value="Guardia">Guardia</option>
                                            <option value="Primer Piso">Primer Piso</option>
                                            <option value="Segundo Piso">Segundo Piso</option>
                                            <option value="Quirófano">Quirófano</option>
                                            <option value="UTI">UTI</option>
                                            <option value="Pediatría">Pediatría</option>
                                            <option value="Maternidad">Maternidad</option>
                                            <option value="Administración">Administración</option>
                                            <option value="Depósito">Depósito</option>
                                            <option value="Otro">Otro</option>
                                        </select>
                                    </div>
                                    
                                    <div className={styles.formGroup}>
                                        <label className={styles.formLabel}>
                                            <span className={styles.labelIcon}>👤</span>
                                            Responsable *
                                        </label>
                                        <input
                                            type="text"
                                            className={styles.formInput}
                                            value={repartoData.responsable}
                                            onChange={(e) => setRepartoData({...repartoData, responsable: e.target.value})}
                                            placeholder="Nombre del responsable"
                                            required
                                        />
                                    </div>
                                    
                                    <div className={styles.formGroup}>
                                        <label className={styles.formLabel}>
                                            <span className={styles.labelIcon}>🔍</span>
                                            Buscar Productos Disponibles
                                        </label>
                                        <input
                                            type="text"
                                            className={styles.formInput}
                                            value={busquedaReparto}
                                            onChange={(e) => setBusquedaReparto(e.target.value)}
                                            placeholder="Buscar por nombre..."
                                        />
                                    </div>
                                    
                                    <div className={styles.formGroup}>
                                        <label className={styles.formLabel}>
                                            <span className={styles.labelIcon}>📝</span>
                                            Observaciones
                                        </label>
                                        <textarea
                                            className={styles.formTextarea}
                                            value={repartoData.nota}
                                            onChange={(e) => setRepartoData({...repartoData, nota: e.target.value})}
                                            placeholder="Notas adicionales..."
                                            rows={3}
                                        />
                                    </div>
                                    
                                    <div className={styles.summaryCard}>
                                        <h5 className={styles.summaryTitle}>
                                            <span className={styles.summaryIcon}>📊</span>
                                            Resumen del Despacho
                                        </h5>
                                        <div className={styles.summaryGrid}>
                                            <div className={styles.summaryItem}>
                                                <span className={styles.summaryLabel}>Productos</span>
                                                <span className={styles.summaryValue}>{productosReparto.length}</span>
                                            </div>
                                            <div className={styles.summaryItem}>
                                                <span className={styles.summaryLabel}>Unidades</span>
                                                <span className={styles.summaryValue}>{totalesReparto.unidades}</span>
                                            </div>
                                            <div className={styles.summaryItem}>
                                                <span className={styles.summaryLabel}>Valor Total</span>
                                                <span className={styles.summaryValue} style={{color: '#e74c3c'}}>
                                                    {formatCurrency(totalesReparto.valor)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Panel derecho: Productos para repartir */}
                                <div className={styles.cargaPanel}>
                                    <div className={styles.panelHeader}>
                                        <h4 className={styles.panelTitle}>
                                            <span className={styles.panelIcon}>📦</span>
                                            Productos a Repartir ({productosReparto.length})
                                        </h4>
                                        <div className={styles.panelTotal}>
                                            <span className={styles.totalLabel}>Total a repartir:</span>
                                            <span className={styles.totalValue}>{totalesReparto.unidades} unidades</span>
                                            <span className={styles.totalValue} style={{color: '#e74c3c'}}>
                                                {formatCurrency(totalesReparto.valor)}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {productosReparto.length === 0 ? (
                                        <div className={styles.noProductsMessage}>
                                            <span className={styles.noProductsIcon}>🚚</span>
                                            <p>Busque productos disponibles para repartir</p>
                                            <small>Busque productos arriba y haga clic para agregarlos</small>
                                        </div>
                                    ) : (
                                        <div className={styles.cargaList}>
                                            {productosReparto.map((producto, index) => (
                                                <div key={producto.id} className={styles.cargaItem}>
                                                    <div className={styles.cargaItemHeader}>
                                                        <div className={styles.cargaItemInfo}>
                                                            <strong className={styles.cargaItemName}>
                                                                {producto.nombre.replace(/_/g, " ")}
                                                            </strong>
                                                            <button 
                                                                className={styles.removeButton}
                                                                onClick={() => quitarDelReparto(producto.id)}
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                        <div className={styles.cargaItemDetails}>
                                                            <span className={styles.cargaTipo}>
                                                                {producto.tipo === "medicamento" ? "💊 Medicamento" : "🧷 Descartable"}
                                                            </span>
                                                            <span className={styles.cargaPresentacion}>
                                                                {producto.presentacion}
                                                            </span>
                                                            <span className={styles.cargaPrecio}>
                                                                {formatCurrency(producto.precio)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className={styles.cargaItemStock}>
                                                        <div className={styles.stockInfo}>
                                                            <span>Stock disponible: {producto.stockAnterior}</span>
                                                            <span className={styles.arrowIcon}>→</span>
                                                            <span>Nuevo stock: {producto.stockNuevo}</span>
                                                        </div>
                                                    </div>
                                                    <div className={styles.cargaControls}>
                                                        <div className={styles.cargaControlGroup}>
                                                            <label className={styles.controlLabel}>
                                                                <span className={styles.labelIcon}>📦</span>
                                                                Cantidad a repartir:
                                                            </label>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                max={producto.stockAnterior}
                                                                className={styles.cantidadInput}
                                                                value={producto.cantidadReparto}
                                                                onChange={(e) => actualizarCantidadReparto(producto.id, e.target.value)}
                                                                placeholder="Cantidad"
                                                            />
                                                            <span className={styles.stockMax}>
                                                                Máx: {producto.stockAnterior}
                                                            </span>
                                                        </div>
                                                        <div className={styles.itemTotal}>
                                                            <span className={styles.totalLabel}>Subtotal:</span>
                                                            <span className={styles.totalValue} style={{color: '#e74c3c'}}>
                                                                {formatCurrency((parseInt(producto.cantidadReparto) || 0) * producto.precio)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    
                                    {/* Productos disponibles para agregar */}
                                    <div className={styles.availableProducts}>
                                        <h5 className={styles.availableTitle}>
                                            <span className={styles.availableIcon}>💊</span>
                                            Productos Disponibles ({items.filter(item => item.stockActual > 0 && normalizeText(item.nombre).includes(normalizeText(busquedaReparto))).length})
                                        </h5>
                                        <div className={styles.availableGrid}>
                                            {items
                                                .filter(item => 
                                                    item.stockActual > 0 && 
                                                    normalizeText(item.nombre).includes(normalizeText(busquedaReparto))
                                                )
                                                .slice(0, 12)
                                                .map(item => (
                                                    <div 
                                                        key={item.id} 
                                                        className={styles.availableItem}
                                                        onClick={() => agregarAlReparto(item)}
                                                    >
                                                        <span className={styles.availableIcon}>
                                                            {item.tipo === "medicamento" ? "💊" : "🧷"}
                                                        </span>
                                                        <div className={styles.availableInfo}>
                                                            <span className={styles.availableName}>
                                                                {item.nombre.replace(/_/g, " ")}
                                                            </span>
                                                            <div className={styles.availableDetails}>
                                                                <span className={styles.availableStock}>
                                                                    Stock: {item.stockActual}
                                                                </span>
                                                                <span className={styles.availablePrecio}>
                                                                    {formatCurrency(item.precio)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className={styles.modalFooter} style={{background: '#f8f9fa'}}>
                            <div className={styles.footerTotal}>
                                <span className={styles.totalLabel}>Total del despacho:</span>
                                <div className={styles.totalAmount}>
                                    <span className={styles.totalUnits}>{totalesReparto.unidades} unidades</span>
                                    <span className={styles.totalMoney} style={{color: '#e74c3c'}}>
                                        {formatCurrency(totalesReparto.valor)}
                                    </span>
                                </div>
                            </div>
                            <div className={styles.footerActions}>
                                <button 
                                    className={styles.cancelButton}
                                    onClick={() => {
                                        setRepartoModal(false);
                                        setProductosReparto([]);
                                        setRepartoData({ destino: "Guardia", responsable: "", nota: "" });
                                        setBusquedaReparto("");
                                    }}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    className={styles.submitButton}
                                    onClick={procesarReparto}
                                    disabled={productosReparto.length === 0 || !repartoData.responsable.trim()}
                                    style={{background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)'}}
                                >
                                    Confirmar Reparto ({productosReparto.length} productos)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}