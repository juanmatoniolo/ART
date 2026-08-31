"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { ref, push, update, remove, onValue, get } from "firebase/database";
import { db } from "@/lib/firebase";
import { buildItemKey, formatFecha, getFechaLegible } from "../utils/farmacia";

const grupoDe = (tipo) =>
  tipo === "descartable" ? "descartables" : "medicamentos";

export default function useFarmacia(usuarioActual = null) {
  const [medicamentos, setMedicamentos] = useState({});
  const [descartables, setDescartables] = useState({});
  const [movimientos, setMovimientos] = useState({});
  const [listasPrecios, setListasPrecios] = useState([]);
  const [mensaje, setMensaje] = useState(null);

  const mostrarMensaje = useCallback((tipo, titulo, msg) => {
    setMensaje({ tipo, titulo, mensaje: msg });
  }, []);
  const cerrarMensaje = useCallback(() => setMensaje(null), []);

  // ─── Suscripciones RTDB ────────────────────────────────────────────────
  useEffect(() => {
    const subs = [
      onValue(ref(db, "medydescartables/medicamentos"), (s) =>
        setMedicamentos(s.val() || {})
      ),
      onValue(ref(db, "medydescartables/descartables"), (s) =>
        setDescartables(s.val() || {})
      ),
      onValue(ref(db, "movimientos"), (s) =>
        setMovimientos(s.val() || {})
      ),
      onValue(ref(db, "listas_precios"), (s) => {
        const v = s.val() || {};
        setListasPrecios(
          Object.entries(v).map(([id, val]) => ({ id, ...val }))
        );
      }),
    ];
    return () => subs.forEach((unsub) => unsub());
  }, []);

  // ─── items: array plano normalizado ───────────────────────────────────
  const items = useMemo(() => {
    const map = (obj, tipo) =>
      Object.entries(obj).map(([key, v]) => {
        const nombre = v.nombre || key || "Sin nombre";
        const pcosto = Number(v.precioCosto ?? v.precioReferencia) || 0;
        return {
          ...v,
          id: key,
          nombre: nombre,
          nombreLimpio: nombre.replace(/_/g, " "),
          tipo: v.tipo || tipo,
          tipoLabel:
            (v.tipo || tipo) === "medicamento" ? "Medicamento" : "Descartable",
          precioCosto: pcosto,
          precioFacturacion: Number(v.precioFacturacion) || 0,
          precioOtros: Number(v.precioOtros) || 0,
          precio: pcosto,
          precioReferencia: pcosto,
          stockActual: Number(v.stockActual) || 0,
          stockMinimo: Number(v.stockMinimo) || 0,
          activo: v.activo !== false,
        };
      });
    return [
      ...map(medicamentos, "medicamento"),
      ...map(descartables, "descartable"),
    ].sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
  }, [medicamentos, descartables]);

  // ─── movimientos normalizados ─────────────────────────────────────────
  const listaMovimientos = useMemo(() => {
    const construir = (obj, tipo) =>
      Object.entries(obj).map(([id, m]) => {
        const ts = m.fecha ? Date.parse(m.fecha) : m.timestamp || Date.now();
        // Normalizar productos: si no tiene array (ajustes antiguos), crearlo desde campos directos
        let productos = m.productos || [];
        if (productos.length === 0 && m.tipo === "ajuste" && m.productoId) {
          productos = [
            {
              itemId: m.productoId,
              itemNombre: m.productoNombre,
              cantidad: Math.abs(m.cantidad) || 0,
              stockAnterior: m.stockAnterior,
              stockNuevo: m.stockNuevo,
              tipo: m.tipoProducto || "medicamento",
              precioUnitario: 0,
            },
          ];
        }
        const totalUnidades = productos.reduce(
          (acc, p) => acc + (Number(p.cantidad) || 0),
          0
        );
        const valorTotal = productos.reduce(
          (acc, p) =>
            acc + (Number(p.cantidad) || 0) * (Number(p.precioUnitario) || 0),
          0
        );
        return {
          ...m,
          id: m.id || id,
          tipo: m.tipo || tipo,
          productos,
          totalProductos: productos.length,
          totalUnidades,
          valorTotal,
          usuario: m.usuario || "Usuario desconocido",
          fechaLegible: getFechaLegible(ts),
          fechaFormatted: formatFecha(ts),
          _ts: ts,
        };
      });
    return construir(movimientos, "movimiento").sort((a, b) => b._ts - a._ts);
  }, [movimientos]);

  // ─── estadísticas ─────────────────────────────────────────────────────
  const estadisticas = useMemo(() => {
    const activos = items.filter((i) => i.activo);
    return {
      totalItems: activos.length,
      itemsSinStock: activos.filter((i) => i.stockActual === 0).length,
      itemsBajoStock: activos.filter(
        (i) => i.stockActual > 0 && i.stockActual < i.stockMinimo
      ).length,
      valorTotalStock: activos.reduce(
        (acc, i) => acc + i.stockActual * i.precioCosto,
        0
      ),
    };
  }, [items]);

  const itemsBajoStockList = useMemo(
    () =>
      items
        .filter((i) => i.activo && i.stockActual < i.stockMinimo)
        .sort(
          (a, b) =>
            a.stockActual / (a.stockMinimo || 1) -
            b.stockActual / (b.stockMinimo || 1)
        ),
    [items]
  );

  // ─── Catálogo para Carga Masiva ───────────────────────────────────────
  const cargarCatalogo = useCallback(async () => {
    const snap = await get(ref(db, "medydescartables"));
    const data = snap.val() || {};
    const map = (obj = {}, tipo) =>
      Object.entries(obj)
        .map(([key, v]) => {
          const pcosto = Number(v.precioCosto ?? v.precioReferencia) || 0;
          return {
            ...v,
            id: key,
            nombre: v.nombre || "Sin nombre",
            tipo: v.tipo || tipo,
            tipoLabel:
              (v.tipo || tipo) === "medicamento" ? "Medicamento" : "Descartable",
            precioCosto: pcosto,
            precioFacturacion: Number(v.precioFacturacion) || 0,
            precioOtros: Number(v.precioOtros) || 0,
            precio: pcosto,
            stockActual: Number(v.stockActual) || 0,
          };
        })
        .filter((i) => i.activo !== false);
    return [
      ...map(data.medicamentos, "medicamento"),
      ...map(data.descartables, "descartable"),
    ].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, []);

  // ─── Agregar producto ─────────────────────────────────────────────────
  const agregarProducto = useCallback(
    async (form) => {
      try {
        const nombre = (form.nombre || "").trim();
        if (!nombre) {
          mostrarMensaje("warning", "Falta el nombre", "Ingresá un nombre de producto.");
          return false;
        }
        const precioCosto = parseFloat(form.precioCosto);
        if (!(precioCosto > 0)) {
          mostrarMensaje("warning", "Precio de costo inválido", "El precio de costo debe ser mayor a 0.");
          return false;
        }

        const key = buildItemKey(nombre);
        const grupo = grupoDe(form.tipo);
        const productoRef = ref(db, `medydescartables/${grupo}/${key}`);

        const snap = await get(productoRef);
        if (snap.exists() && snap.val().activo !== false) {
          mostrarMensaje("error", "Producto duplicado", "Ya existe un producto con ese nombre.");
          return false;
        }

        await update(productoRef, {
          activo: true,
          nombre: key,
          tipo: form.tipo,
          presentacion: form.presentacion || "unidad",
          precioCosto,
          precioFacturacion: parseFloat(form.precioFacturacion) || 0,
          precioOtros: parseFloat(form.precioOtros) || 0,
          stockActual: parseInt(form.stockActual) || 0,
          stockMinimo: parseInt(form.stockMinimo) || 10,
        });
        mostrarMensaje("success", "Producto agregado", `${nombre} se cargó correctamente.`);
        return true;
      } catch (e) {
        console.error(e);
        mostrarMensaje("error", "Error", "No se pudo agregar el producto.");
        return false;
      }
    },
    [mostrarMensaje]
  );

  // ─── Editar producto ──────────────────────────────────────────────────
  const editarProducto = useCallback(
    async (id, nuevosDatos) => {
      try {
        const productoActual = items.find((p) => p.id === id);
        if (!productoActual) {
          mostrarMensaje("error", "Error", "Producto no encontrado.");
          return false;
        }

        const grupoAnterior = grupoDe(productoActual.tipo);
        const grupoNuevo = grupoDe(nuevosDatos.tipo);
        const datosActualizados = {
          nombre: nuevosDatos.nombre,
          tipo: nuevosDatos.tipo,
          presentacion: nuevosDatos.presentacion,
          precioCosto: parseFloat(nuevosDatos.precioCosto) || 0,
          precioFacturacion: parseFloat(nuevosDatos.precioFacturacion) || 0,
          precioOtros: parseFloat(nuevosDatos.precioOtros) || 0,
          stockActual: parseInt(nuevosDatos.stockActual) || 0,
          stockMinimo: parseInt(nuevosDatos.stockMinimo) || 0,
        };

        const stockAnterior = productoActual.stockActual || 0;
        const stockNuevo = datosActualizados.stockActual;
        const diferencia = stockNuevo - stockAnterior;

        if (grupoAnterior !== grupoNuevo) {
          await remove(ref(db, `medydescartables/${grupoAnterior}/${id}`));
          await update(ref(db, `medydescartables/${grupoNuevo}/${id}`), datosActualizados);
        } else {
          await update(ref(db, `medydescartables/${grupoAnterior}/${id}`), datosActualizados);
        }

        if (diferencia !== 0) {
          const movRef = ref(db, "movimientos");
          const movimientoAjuste = {
            tipo: "ajuste",
            fecha: new Date().toISOString(),
            usuario: usuarioActual?.user || usuarioActual?.nombre || "Sistema",
            detalle: `Edición manual de stock (${diferencia > 0 ? "+" : ""}${diferencia})`,
            productos: [
              {
                itemId: id,
                itemNombre: productoActual.nombre || id,
                cantidad: Math.abs(diferencia),
                stockAnterior,
                stockNuevo,
                tipo: productoActual.tipo,
                precioUnitario: 0,
              },
            ],
          };
          await push(movRef, movimientoAjuste);
        }

        mostrarMensaje("success", "Producto actualizado", `Se guardaron los cambios${diferencia !== 0 ? " y se registró un movimiento de ajuste" : ""}.`);
        return true;
      } catch (e) {
        console.error(e);
        mostrarMensaje("error", "Error", "No se pudo editar el producto.");
        return false;
      }
    },
    [items, usuarioActual, mostrarMensaje]
  );

  // ─── Eliminar producto (baja lógica) ──────────────────────────────────
  const eliminarProducto = useCallback(
    async (item) => {
      try {
        const grupo = grupoDe(item.tipo);
        await update(ref(db, `medydescartables/${grupo}/${item.id}`), {
          activo: false,
        });
        mostrarMensaje("success", "Producto eliminado", `${String(item.nombre).replace(/_/g, " ")} se dio de baja.`);
        return true;
      } catch (e) {
        console.error(e);
        mostrarMensaje("error", "Error", "No se pudo eliminar el producto.");
        return false;
      }
    },
    [mostrarMensaje]
  );

  // ─── Carga masiva (ingreso de stock) ──────────────────────────────────
  const procesarCargaMasiva = useCallback(
    async (seleccionados) => {
      try {
        if (!seleccionados?.length) return false;
        const ts = Date.now();
        const fecha = new Date(ts).toISOString();
        const updates = {};
        const productos = [];

        seleccionados.forEach((p) => {
          const cantidad = parseInt(p.cantidad) || 0;
          if (cantidad <= 0) return;
          const stockAnterior = Number(p.stockAnterior) || 0;
          const stockNuevo = Number(p.stockNuevo ?? stockAnterior + cantidad);
          const grupo = grupoDe(p.tipo);

          updates[`medydescartables/${grupo}/${p.id}/stockActual`] = stockNuevo;
          productos.push({
            cantidad,
            itemId: p.id,
            itemNombre: p.nombre,
            motivo: "Carga masiva",
            precioUnitario: Number(p.precioCosto ?? p.precio) || 0,
            presentacion: p.presentacion || "unidad",
            stockAnterior,
            stockNuevo,
            tipo: p.tipo,
          });
        });

        if (!productos.length) return false;

        updates[`movimientos/ingreso_${ts}`] = {
          id: `ingreso_${ts}`,
          tipo: "ingreso",
          fecha,
          usuario: usuarioActual?.user || usuarioActual?.nombre || "Usuario desconocido",
          productos,
        };

        await update(ref(db), updates);
        mostrarMensaje("success", "Ingreso registrado", `${productos.length} productos cargados.`);
        return true;
      } catch (e) {
        console.error(e);
        mostrarMensaje("error", "Error", "No se pudo procesar la carga masiva.");
        return false;
      }
    },
    [usuarioActual, mostrarMensaje]
  );

  // ─── Reparto (despacho a un sector) ───────────────────────────────────
  const procesarReparto = useCallback(
    async (productos, datos) => {
      try {
        if (!productos?.length) return false;
        const ts = Date.now();
        const fecha = new Date(ts).toISOString();
        const updates = {};
        const lineas = [];

        for (const p of productos) {
          const cantidad = parseInt(p.cantidadReparto ?? p.cantidad) || 0;
          if (cantidad <= 0) continue;

          const stockAnterior = Number(p.stockAnterior) || 0;
          const stockNuevo = Math.max(0, stockAnterior - cantidad);
          const grupo = grupoDe(p.tipo);

          updates[`medydescartables/${grupo}/${p.id}/stockActual`] = stockNuevo;
          lineas.push({
            cantidad,
            itemId: p.id,
            itemNombre: String(p.nombre || "Sin nombre").trim(),
            precioUnitario: Number(p.precioCosto ?? p.precio) || 0,
            presentacion: p.presentacion || "unidad",
            stockAnterior,
            stockNuevo,
            tipo: p.tipo || "medicamento",
          });
        }

        if (!lineas.length) return false;

        updates[`movimientos/reparto_${ts}`] = {
          id: `reparto_${ts}`,
          tipo: "reparto",
          fecha,
          destino: datos?.destino || "Sin destino",
          responsable: datos?.responsable || "",
          nota: datos?.nota?.trim() || "Sin observaciones",
          usuario: usuarioActual?.user || usuarioActual?.nombre || "Usuario desconocido",
          productos: lineas,
        };

        await update(ref(db), updates);
        mostrarMensaje("success", "Reparto registrado", `Despacho a ${datos?.destino} confirmado.`);
        return true;
      } catch (e) {
        console.error(e);
        mostrarMensaje("error", "Error", "No se pudo procesar el reparto.");
        return false;
      }
    },
    [usuarioActual, mostrarMensaje]
  );

  // ─── Importar desde CSV/Excel ─────────────────────────────────────────
  const importarDesdeExcel = useCallback(
    async (productos) => {
      try {
        const validos = (productos || []).filter((p) => p.valido);
        if (!validos.length) {
          mostrarMensaje("warning", "Sin datos válidos", "No hay filas válidas para importar.");
          return false;
        }

        await remove(ref(db, "medydescartables"));

        const updates = {};
        const medicamentos = {};
        const descartables = {};

        validos.forEach((p) => {
          const key = buildItemKey(p.nombre);
          const grupo = p.tipo === "descartable" ? "descartables" : "medicamentos";
          const data = {
            activo: true,
            nombre: key,
            tipo: p.tipo,
            presentacion: p.presentacion || "unidad",
            precioCosto: Number(p.precioCosto) || 0,
            precioFacturacion: Number(p.precioFacturacion) || 0,
            precioOtros: Number(p.precioOtros) || 0,
            stockActual: parseInt(p.stockInicial) || 0,
            stockMinimo: parseInt(p.stockMinimo) || 10,
          };
          if (grupo === "medicamentos") {
            medicamentos[key] = data;
          } else {
            descartables[key] = data;
          }
        });

        updates["medydescartables/medicamentos"] = medicamentos;
        updates["medydescartables/descartables"] = descartables;

        await update(ref(db), updates);
        mostrarMensaje("success", "Importación completa", `${validos.length} productos importados. Catálogo anterior reemplazado.`);
        return true;
      } catch (e) {
        console.error(e);
        mostrarMensaje("error", "Error", "No se pudo importar el archivo.");
        return false;
      }
    },
    [mostrarMensaje]
  );

  // ─── Exportar inventario / movimientos ────────────────────────────────
  const exportarDatos = useCallback(
    (opciones, movs = listaMovimientos) => {
      const { tipo, incluirSinStock = true } = opciones || {};
      const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      let headers = [],
        filas = [],
        nombreArchivo = "export.csv";

      if (tipo === "stock" || tipo === "stock_bajo") {
        let data = items.filter((i) => i.activo);
        if (tipo === "stock_bajo")
          data = data.filter((i) => i.stockActual < i.stockMinimo);
        if (!incluirSinStock)
          data = data.filter((i) => i.stockActual > 0);
        headers = [
          "Nombre",
          "Tipo",
          "Presentacion",
          "Costo",
          "Facturación",
          "Otros",
          "Stock",
          "Stock minimo",
          "Valor total (costo)",
        ];
        filas = data.map((i) => [
          String(i.nombre).replace(/_/g, " "),
          i.tipo,
          i.presentacion,
          i.precioCosto,
          i.precioFacturacion,
          i.precioOtros,
          i.stockActual,
          i.stockMinimo,
          i.stockActual * i.precioCosto,
        ]);
        nombreArchivo =
          tipo === "stock_bajo" ? "stock_bajo.csv" : "inventario.csv";
      } else if (tipo === "movimientos") {
        headers = [
          "Fecha",
          "Tipo",
          "Destino",
          "Responsable",
          "Usuario",
          "Producto",
          "Cantidad",
          "Precio unitario",
          "Valor",
        ];
        movs.forEach((m) => {
          (m.productos || []).forEach((p) => {
            filas.push([
              m.fechaFormatted,
              m.tipo,
              m.destino || "",
              m.responsable || "",
              m.usuario || "",
              String(p.itemNombre).replace(/_/g, " "),
              p.cantidad,
              p.precioUnitario,
              (Number(p.cantidad) || 0) * (Number(p.precioUnitario) || 0),
            ]);
          });
        });
        nombreArchivo = "movimientos.csv";
      }

      const csv = [headers, ...filas]
        .map((f) => f.map(esc).join(";"))
        .join("\n");
      const blob = new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8;",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = nombreArchivo;
      link.click();
      URL.revokeObjectURL(link.href);
      mostrarMensaje("success", "Exportado", `Se descargó ${nombreArchivo}.`);
    },
    [items, listaMovimientos, mostrarMensaje]
  );

  // ─── Listas de precios ────────────────────────────────────────────────
  const guardarListaPrecio = useCallback(
    async (lista) => {
      try {
        if (lista.id) {
          const { id, ...data } = lista;
          await update(ref(db, `listas_precios/${id}`), data);
        } else {
          await push(ref(db, "listas_precios"), lista);
        }
        return true;
      } catch (e) {
        console.error(e);
        mostrarMensaje("error", "Error", "No se pudo guardar la lista.");
        return false;
      }
    },
    [mostrarMensaje]
  );

  const eliminarListaPrecio = useCallback(
    async (id) => {
      try {
        await remove(ref(db, `listas_precios/${id}`));
        return true;
      } catch (e) {
        console.error(e);
        mostrarMensaje("error", "Error", "No se pudo eliminar la lista.");
        return false;
      }
    },
    [mostrarMensaje]
  );

  const exportarListasPrecios = useCallback(
    (listaIds = [], data = items) => {
      const sel = listasPrecios
        .filter((l) => listaIds.includes(l.id))
        .sort((a, b) => (a.orden || 0) - (b.orden || 0));
      if (!sel.length) {
        mostrarMensaje("warning", "Sin selección", "Elegí al menos una lista.");
        return;
      }

      const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const headers = [
        "Producto",
        "Tipo",
        "Presentacion",
        "Costo",
        ...sel.map((l) => `${l.nombre} (x${l.multiplicador})`),
      ];
      const filas = data
        .filter((i) => i.activo)
        .map((i) => {
          const c = Number(i.precioCosto) || 0;
          return [
            String(i.nombre).replace(/_/g, " "),
            i.tipo,
            i.presentacion,
            c,
            ...sel.map((l) => Math.round(c * Number(l.multiplicador || 1))),
          ];
        });

      const csv = [headers, ...filas]
        .map((f) => f.map(esc).join(";"))
        .join("\n");
      const blob = new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8;",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download =
        sel.length === 1
          ? `precios_${sel[0].nombre}.csv`
          : "listas_precios.csv";
      link.click();
      URL.revokeObjectURL(link.href);
      mostrarMensaje("success", "Exportado", `${sel.length} lista(s) exportada(s).`);
    },
    [items, listasPrecios, mostrarMensaje]
  );

  // ─── ELIMINAR MOVIMIENTO CON REVERSIÓN DE STOCK Y AUDITORÍA ─────────────
  const eliminarMovimiento = useCallback(
    async (id) => {
      try {
        const movSnap = await get(ref(db, `movimientos/${id}`));
        const movimiento = movSnap.val();
        if (!movimiento) {
          mostrarMensaje("error", "Error", "Movimiento no encontrado.");
          return false;
        }

        // 🔒 Los ajustes no se pueden eliminar
        if (movimiento.tipo === "ajuste") {
          mostrarMensaje("error", "No permitido", "Los ajustes no se pueden eliminar.");
          return false;
        }

        const updates = {};
        const productosAfectados = movimiento.productos || [];

        // Revertir stock en ingresos y repartos
        for (const p of productosAfectados) {
          const cantidad = Number(p.cantidad) || 0;
          if (cantidad === 0) continue;
          const grupo = grupoDe(p.tipo);
          const productoPath = `medydescartables/${grupo}/${p.itemId}`;
          const prodSnap = await get(ref(db, productoPath));
          if (!prodSnap.exists()) continue;
          const stockActual = Number(prodSnap.val().stockActual) || 0;
          let nuevoStock = stockActual;
          if (movimiento.tipo === "ingreso") {
            nuevoStock = Math.max(0, stockActual - cantidad);
          } else if (movimiento.tipo === "reparto") {
            nuevoStock = stockActual + cantidad;
          }
          updates[`${productoPath}/stockActual`] = nuevoStock;
        }

        // Auditoría
        updates[`auditoria_movimientos/${id}`] = {
          ...movimiento,
          eliminadoPor: usuarioActual?.user || usuarioActual?.nombre || "Sistema",
          eliminadoEn: new Date().toISOString(),
        };
        updates[`movimientos/${id}`] = null;

        await update(ref(db), updates);
        setMovimientos((prev) => {
          const newMov = { ...prev };
          delete newMov[id];
          return newMov;
        });
        mostrarMensaje("success", "Movimiento eliminado", "Se revirtió el stock y se registró en auditoría.");
        return true;
      } catch (error) {
        console.error("Error al eliminar movimiento:", error);
        mostrarMensaje("error", "Error", "No se pudo eliminar el movimiento ni revertir el stock.");
        return false;
      }
    },
    [usuarioActual, mostrarMensaje]
  );

  // ─── EDITAR MOVIMIENTO (AJUSTES: actualiza stock; OTROS: campos informativos) ──
  const editarMovimiento = useCallback(
    async (id, nuevosDatos) => {
      try {
        const movSnap = await get(ref(db, `movimientos/${id}`));
        const movimientoOriginal = movSnap.val();
        if (!movimientoOriginal) {
          mostrarMensaje("error", "Error", "Movimiento no encontrado.");
          return false;
        }

        // ✅ Si es ajuste, actualizar stock del producto y el movimiento
        if (movimientoOriginal.tipo === "ajuste") {
          // Extraer datos del producto asociado (soporta ambos formatos)
          let productoOriginal;
          if (movimientoOriginal.productos?.length) {
            productoOriginal = movimientoOriginal.productos[0];
          } else if (movimientoOriginal.productoId) {
            productoOriginal = {
              itemId: movimientoOriginal.productoId,
              itemNombre: movimientoOriginal.productoNombre,
              stockAnterior: movimientoOriginal.stockAnterior,
              stockNuevo: movimientoOriginal.stockNuevo,
              tipo: movimientoOriginal.tipoProducto || "medicamento",
            };
          }

          if (!productoOriginal) {
            mostrarMensaje("error", "Error", "El ajuste no tiene producto asociado.");
            return false;
          }

          const itemId = productoOriginal.itemId;
          const tipoProducto = productoOriginal.tipo;
          const grupo = grupoDe(tipoProducto);
          const stockAnteriorOriginal = Number(productoOriginal.stockAnterior) || 0;
          const nuevoStock = Number(nuevosDatos.stockNuevo);

          if (isNaN(nuevoStock) || nuevoStock < 0) {
            mostrarMensaje("error", "Error", "Stock nuevo debe ser un número mayor o igual a 0.");
            return false;
          }

          // Actualizar stock en el producto
          const productoRef = ref(db, `medydescartables/${grupo}/${itemId}`);
          await update(productoRef, { stockActual: nuevoStock });

          // Actualizar el movimiento
          const fecha = new Date().toISOString();
          const movimientoEditado = {
            ...movimientoOriginal,
            productos: [
              {
                ...productoOriginal,
                stockNuevo: nuevoStock,
                cantidad: Math.abs(nuevoStock - stockAnteriorOriginal),
                stockAnterior: stockAnteriorOriginal,
              },
            ],
            editadoPor: usuarioActual?.user || usuarioActual?.nombre || "Sistema",
            editadoEn: fecha,
          };
          await update(ref(db, `movimientos/${id}`), movimientoEditado);

          // Auditoría
          await update(ref(db, `auditoria_movimientos/${id}`), {
            original: movimientoOriginal,
            editado: movimientoEditado,
            editadoPor: usuarioActual?.user || usuarioActual?.nombre || "Sistema",
            editadoEn: fecha,
          });

          mostrarMensaje("success", "Ajuste actualizado", "Stock corregido correctamente.");
          return true;
        }

        // Para ingresos/repartos: solo campos informativos
        const cambios = {};
        if (nuevosDatos.destino !== undefined) cambios.destino = nuevosDatos.destino;
        if (nuevosDatos.responsable !== undefined) cambios.responsable = nuevosDatos.responsable;
        if (nuevosDatos.nota !== undefined) cambios.nota = nuevosDatos.nota;

        // Solo actualizar si hay cambios reales
        if (Object.keys(cambios).length > 0) {
          await update(ref(db, `movimientos/${id}`), cambios);

          const auditoriaData = {
            original: movimientoOriginal,
            editado: { ...movimientoOriginal, ...cambios },
            editadoPor: usuarioActual?.user || usuarioActual?.nombre || "Sistema",
            editadoEn: new Date().toISOString(),
          };
          await update(ref(db, `auditoria_movimientos/${id}`), auditoriaData);
        } else {
          mostrarMensaje("info", "Sin cambios", "No se realizaron modificaciones.");
          return true;
        }

        mostrarMensaje("success", "Movimiento actualizado", "Se guardaron los cambios.");
        return true;
      } catch (error) {
        console.error("Error al editar movimiento:", error);
        mostrarMensaje("error", "Error", "No se pudo editar el movimiento.");
        return false;
      }
    },
    [usuarioActual, mostrarMensaje]
  );

  // ─── API del hook ─────────────────────────────────────────────────────
  return {
    items,
    movimientos: listaMovimientos,
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
    editarMovimiento,
  };
}