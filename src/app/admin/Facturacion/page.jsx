'use client';
import { useState } from 'react';
import * as XLSX from 'xlsx';
import styles from './facturacion.module.css';

export default function Facturacion() {
    const [paciente, setPaciente] = useState({ nombre: '', dni: '' });
    const [practicas, setPracticas] = useState([]);
    const [curaciones, setCuraciones] = useState([]);
    const [laboratorios, setLaboratorios] = useState([]);
    const [nuevaPractica, setNuevaPractica] = useState({
        codigo: '',
        descripcion: '',
        cantidad: 1,
        monto: 0,
        responsable: '',
    });
    const [nuevoCuadro, setNuevoCuadro] = useState({ tipo: '', monto: 0 });

    const agregarPractica = () => {
        const { codigo, descripcion, cantidad, monto, responsable } = nuevaPractica;
        if (!descripcion || monto <= 0) return alert('Completá todos los campos correctamente');
        setPracticas((prev) => [...prev, { codigo, descripcion, cantidad, monto, responsable }]);
        setNuevaPractica({ codigo: '', descripcion: '', cantidad: 1, monto: 0, responsable: '' });
    };

    const agregarCuadro = () => {
        if (!nuevoCuadro.tipo || nuevoCuadro.monto <= 0)
            return alert('Completá tipo de cuadro y monto');
        if (nuevoCuadro.tipo === 'curacion') {
            setCuraciones((prev) => [...prev, { ...nuevoCuadro }]);
        } else if (nuevoCuadro.tipo === 'laboratorio') {
            setLaboratorios((prev) => [...prev, { ...nuevoCuadro }]);
        }
        setNuevoCuadro({ tipo: '', monto: 0 });
    };

    const eliminarPractica = (i) => setPracticas((prev) => prev.filter((_, idx) => idx !== i));

    const totalPracticas = practicas.reduce((a, p) => a + p.monto * p.cantidad, 0);
    const totalCuraciones = curaciones.reduce((a, c) => a + Number(c.monto), 0);
    const totalLaboratorios = laboratorios.reduce((a, c) => a + Number(c.monto), 0);
    const totalGeneral = totalPracticas + totalCuraciones + totalLaboratorios;

    const guardarYDescargarExcel = () => {
        if (!paciente.nombre || !paciente.dni) return alert('Completá los datos del paciente');

        const fecha = new Date().toLocaleString('es-AR');
        const dataPrincipal = [
            ['Borrador de Facturación Clínica'],
            [`Fecha: ${fecha}`],
            [],
            ['Paciente', paciente.nombre],
            ['DNI', paciente.dni],
            [],
            ['Código', 'Descripción', 'Cantidad', 'Monto', 'Responsable', 'Subtotal'],
            ...practicas.map((p) => [
                p.codigo,
                p.descripcion,
                p.cantidad,
                p.monto,
                p.responsable,
                p.cantidad * p.monto,
            ]),
            [],
            ['Cuadros de Curación', '', '', '', '', totalCuraciones],
            ['Cuadros de Laboratorio', '', '', '', '', totalLaboratorios],
            [],
            ['TOTAL GENERAL', '', '', '', '', totalGeneral],
        ];

        const ws = XLSX.utils.aoa_to_sheet(dataPrincipal);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Borrador');

        const nombreArchivo = `Borrador_${paciente.nombre.replace(/\s/g, '_')}_${Date.now()}.xlsx`;
        XLSX.writeFile(wb, nombreArchivo);
    };

    return (
        <div className={styles.wrapper}>
            <h2>🧾 Borrador de Facturación Manual</h2>

            {/* === PACIENTE === */}
            <div className={styles.card}>
                <h3>Datos del Paciente</h3>
                <input
                    type="text"
                    placeholder="Nombre completo"
                    value={paciente.nombre}
                    onChange={(e) => setPaciente({ ...paciente, nombre: e.target.value })}
                />
                <input
                    type="text"
                    placeholder="DNI"
                    value={paciente.dni}
                    onChange={(e) => setPaciente({ ...paciente, dni: e.target.value })}
                />
            </div>

            {/* === PRÁCTICAS === */}
            <div className={styles.card}>
                <h3>Agregar Práctica</h3>
                <div className={styles.manualRow}>
                    <input
                        type="text"
                        placeholder="Código"
                        value={nuevaPractica.codigo}
                        onChange={(e) => setNuevaPractica({ ...nuevaPractica, codigo: e.target.value })}
                    />
                    <input
                        type="text"
                        placeholder="Descripción"
                        value={nuevaPractica.descripcion}
                        onChange={(e) => setNuevaPractica({ ...nuevaPractica, descripcion: e.target.value })}
                    />
                    <input
                        type="number"
                        min="1"
                        placeholder="Cantidad"
                        value={nuevaPractica.cantidad}
                        onChange={(e) => setNuevaPractica({ ...nuevaPractica, cantidad: Number(e.target.value) })}
                    />
                    <input
                        type="number"
                        min="1"
                        placeholder="Monto"
                        value={nuevaPractica.monto}
                        onChange={(e) => setNuevaPractica({ ...nuevaPractica, monto: Number(e.target.value) })}
                    />
                    <input
                        type="text"
                        placeholder="Dr/Dra o Clínica"
                        value={nuevaPractica.responsable}
                        onChange={(e) => setNuevaPractica({ ...nuevaPractica, responsable: e.target.value })}
                    />
                    <button onClick={agregarPractica} className={styles.addBtn}>➕</button>
                </div>

                {/* Tabla de prácticas */}
                {practicas.length > 0 && (
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Descripción</th>
                                <th>Cant.</th>
                                <th>Monto</th>
                                <th>Responsable</th>
                                <th>Subtotal</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {practicas.map((p, i) => (
                                <tr key={i}>
                                    <td>{p.codigo}</td>
                                    <td>{p.descripcion}</td>
                                    <td>{p.cantidad}</td>
                                    <td>${p.monto}</td>
                                    <td>{p.responsable}</td>
                                    <td>${p.monto * p.cantidad}</td>
                                    <td>
                                        <button className={styles.delBtn} onClick={() => eliminarPractica(i)}>
                                            ❌
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* === CUADROS === */}
            <div className={styles.card}>
                <h3>Agregar Cuadro (Curación o Laboratorio)</h3>
                <div className={styles.manualRow}>
                    <select
                        value={nuevoCuadro.tipo}
                        onChange={(e) => setNuevoCuadro({ ...nuevoCuadro, tipo: e.target.value })}
                    >
                        <option value="">Seleccionar tipo...</option>
                        <option value="curacion">Curación</option>
                        <option value="laboratorio">Laboratorio</option>
                    </select>
                    <input
                        type="number"
                        placeholder="Monto total"
                        value={nuevoCuadro.monto}
                        onChange={(e) => setNuevoCuadro({ ...nuevoCuadro, monto: Number(e.target.value) })}
                    />
                    <button onClick={agregarCuadro} className={styles.addBtn}>➕</button>
                </div>

                <div className={styles.subtotales}>
                    <p>💉 Curaciones: ${totalCuraciones.toLocaleString('es-AR')}</p>
                    <p>🧪 Laboratorios: ${totalLaboratorios.toLocaleString('es-AR')}</p>
                </div>
            </div>

            {/* === TOTAL GENERAL === */}
            <div className={styles.summary}>
                <h3>Total General: ${totalGeneral.toLocaleString('es-AR')}</h3>
                <button onClick={guardarYDescargarExcel}>💾 Guardar y Descargar Excel</button>
            </div>
        </div>
    );
}
