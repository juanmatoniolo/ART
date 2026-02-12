'use client';

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useConvenio } from './ConvenioContext';
import { calcularLaboratorio, money, normalize } from '../utils/calculos';
import styles from './laboratorio.module.css';

export default function LaboratoriosModule({
  laboratoriosAgregados,
  agregarLaboratorio,
  onAtras,
  onSiguiente
}) {
  const { valoresConvenio } = useConvenio();

  const [busqueda, setBusqueda] = useState('');
  const [nomenclador, setNomenclador] = useState([]);
  const [loading, setLoading] = useState(true);

  const [lastAddedId, setLastAddedId] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef(null);

  const valorUB = valoresConvenio?.valorUB ?? 0;

  // Cargar nomenclador bioquímica
  useEffect(() => {
    let mounted = true;

    fetch('/archivos/NomecladorBioquimica.json')
      .then((res) => res.json())
      .then((json) => {
        if (!mounted) return;

        const practicas =
          json.practicas?.map((p) => ({
            tipo: 'laboratorio',
            codigo: String(p.codigo ?? '').trim(),
            descripcion: (p.practica_bioquimica || p.descripcion || '').trim(),
            unidadBioquimica: Number(p.unidad_bioquimica) || 0
          })) || [];

        setNomenclador(practicas);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error cargando laboratorios:', err);
        setLoading(false);
      });

    return () => {
      mounted = false;
      clearTimeout(toastTimer.current);
    };
  }, []);

  const laboratoriosFiltrados = useMemo(() => {
    if (!busqueda) return nomenclador.slice(0, 50);

    const q = normalize(busqueda);
    return nomenclador
      .filter(
        (l) =>
          normalize(l.codigo).includes(q) ||
          normalize(l.descripcion).includes(q)
      )
      .slice(0, 50);
  }, [nomenclador, busqueda]);

  const showToastMessage = useCallback((msg, id) => {
    clearTimeout(toastTimer.current);
    setToastMsg(msg);
    setLastAddedId(id);
    setShowToast(true);
    toastTimer.current = setTimeout(() => setShowToast(false), 2500);
  }, []);

  const handleAgregar = useCallback(
    (laboratorio) => {
      const valores = calcularLaboratorio(laboratorio, valoresConvenio);

      const nuevoLaboratorio = {
        id: `lab-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        ...laboratorio,
        ...valores,
        cantidad: 1
      };

      agregarLaboratorio(nuevoLaboratorio);
      showToastMessage(`✓ "${laboratorio.descripcion?.slice(0, 42)}..." agregado`, nuevoLaboratorio.id);
    },
    [agregarLaboratorio, valoresConvenio, showToastMessage]
  );

  const getPreview = useCallback(
    (laboratorio) => {
      const ub = laboratorio?.unidadBioquimica ?? 0;
      const total = (ub || 0) * (valorUB || 0);
      return { ub, total, formula: `${money(ub)} × ${money(valorUB)}` };
    },
    [valorUB]
  );

  const countAgregados = laboratoriosAgregados?.length ?? 0;

  if (loading) {
    return (
      <div className={styles.tabContent}>
        <h2>🧪 Estudios de Laboratorio</h2>
        <div className={styles.loading}>Cargando laboratorios...</div>
      </div>
    );
  }

  return (
    <div className={styles.tabContent}>
      <h2>🧪 Estudios de Laboratorio</h2>

      {showToast && (
        <div className={styles.toast}>
          <div className={styles.toastInner}>
            <span className={styles.toastIcon}>✓</span>
            {toastMsg}
          </div>
        </div>
      )}

      {/* Header tipo Practicas */}
      <div className={styles.labHeader}>
        <div className={styles.labHeaderTop}>
          <div className={styles.labHeaderText}>
            <p className={styles.labHelp}>
              Los valores se calculan automáticamente: <b>UB × Valor UB</b>
            </p>

            <div className={styles.labChips}>
              <span className={`${styles.chip} ${styles.chipUb}`}>
                <b>Valor UB</b> <span className={styles.chipValue}>{money(valorUB)}</span>
              </span>

              <span className={`${styles.chip} ${styles.chipInfo}`}>
                <b>Agregados</b> <span className={styles.chipValue}>{countAgregados}</span>
              </span>
            </div>
          </div>
        </div>

        <div className={styles.labSearchRow}>
          <input
            type="text"
            placeholder="Buscar por código o descripción…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className={styles.labInput}
            autoComplete="off"
          />

          <div className={styles.labSearchInfo}>
            {laboratoriosFiltrados.length} estudios encontrados
          </div>
        </div>
      </div>

      {/* Mobile cards */}
      <div className={styles.labMobileList}>
        {laboratoriosFiltrados.length === 0 ? (
          <div className={styles.noResults}>No hay resultados para “{busqueda}”.</div>
        ) : (
          laboratoriosFiltrados.map((l, i) => {
            const { ub, total, formula } = getPreview(l);
            const cardKey = `${l.codigo}-${i}`;
            const isRecent = lastAddedId === cardKey;

            return (
              <article
                key={cardKey}
                className={`${styles.labCard} ${isRecent ? styles.labCardRecent : ''}`}
              >
                <div className={styles.labCardTop}>
                  <div className={styles.labCode}>{l.codigo}</div>
                  <span className={styles.labUbBadge}>UB: {money(ub)}</span>
                </div>

                <div className={styles.labDesc}>{l.descripcion}</div>

                <div className={styles.labCostGrid}>
                  <div className={styles.labCostBox}>
                    <span className={styles.labCostLabel}>Fórmula</span>
                    <span className={styles.labBaseLine}>{formula}</span>
                  </div>
                  <div className={styles.labCostBox}>
                    <span className={styles.labCostLabel}>Total</span>
                    <span className={styles.labValueBig}>$ {money(total)}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleAgregar(l)}
                  className={styles.labAddBtn}
                  title="Agregar a factura"
                >
                  ➕ Agregar
                </button>
              </article>
            );
          })
        )}
      </div>

      {/* Desktop table */}
      <div className={styles.labTableWrapper}>
        <table className={styles.labTable}>
          <thead>
            <tr>
              <th className={styles.labThCode}>Código</th>
              <th className={styles.labThDesc}>Práctica Bioquímica</th>
              <th className={styles.labThNum}>U.B.</th>
              <th className={styles.labThNum}>Total</th>
              <th className={styles.labThAction}>Agregar</th>
            </tr>
          </thead>

          <tbody>
            {laboratoriosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.noResultsCell}>
                  No hay resultados para “{busqueda}”.
                </td>
              </tr>
            ) : (
              laboratoriosFiltrados.map((l, i) => {
                const { ub, total, formula } = getPreview(l);
                const rowKey = `${l.codigo}-${i}`;
                const isRecent = lastAddedId === rowKey;

                return (
                  <tr key={rowKey} className={isRecent ? styles.labRowRecent : ''}>
                    <td className={styles.labCodeCell}>{l.codigo}</td>
                    <td className={styles.labDescCell}>{l.descripcion}</td>

                    <td className={styles.labNumCell}>
                      <div className={styles.labBaseLine}>UB</div>
                      <div className={styles.labValueBig}>{money(ub)}</div>
                    </td>

                    <td className={styles.labNumCell}>
                      <div className={styles.labBaseLine}>{formula}</div>
                      <div className={styles.labValueBig}>$ {money(total)}</div>
                    </td>

                    <td className={styles.labActionCell}>
                      <button
                        onClick={() => handleAgregar(l)}
                        className={styles.labAddRound}
                        title="Agregar a factura"
                      >
                        +
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.botonesNavegacion}>
        <button className={styles.btnAtras} onClick={onAtras}>
          ← Atrás
        </button>
        <button className={styles.btnSiguiente} onClick={onSiguiente}>
          Siguiente → Medicamentos
        </button>
      </div>
    </div>
  );
}
