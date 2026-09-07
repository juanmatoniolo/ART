'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ref, onValue, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import styles from '../conveniosos.module.css';

export default function DetalleConvenioPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const [convenio, setConvenio] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [activeTab, setActiveTab] = useState('valores');
  const [busqueda, setBusqueda] = useState('');

  // Activar modo edición si viene ?edit=1
  useEffect(() => {
    if (searchParams.get('edit') === '1') {
      setEditMode(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!id) return;
    const convRef = ref(db, `facturacionOS/convenios/${id}`);
    const unsub = onValue(convRef, (snap) => {
      const data = snap.val();
      if (!data) {
        setConvenio(null);
        setFormData(null);
      } else {
        setConvenio(data);
        setFormData(data);
      }
    });
    return () => unsub();
  }, [id]);

  if (!convenio && !formData) {
    return <div className={styles.loading}>Convenio no encontrado</div>;
  }
  if (!convenio || !formData) {
    return <div className={styles.loading}>Cargando...</div>;
  }

  const handleChange = (campo, index, subcampo, valor) => {
    setFormData(prev => {
      const nuevo = { ...prev };
      const lista = [...(nuevo[campo] || [])];
      lista[index] = { ...lista[index], [subcampo]: valor };
      nuevo[campo] = lista;
      return nuevo;
    });
  };

  const handleGuardar = async () => {
    setGuardando(true);
    try {
      await update(ref(db, `facturacionOS/convenios/${id}`), formData);
      setEditMode(false);
    } catch (err) {
      console.error(err);
      alert('Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  // Filtros por pestaña
  const filtrarValores = () => {
    const term = busqueda.toLowerCase().trim();
    if (!term) return formData.valoresArancelarios || [];
    return (formData.valoresArancelarios || []).filter(item =>
      String(item.concepto || '').toLowerCase().includes(term) ||
      String(item.valor || '').includes(term)
    );
  };

  const filtrarModulos = () => {
    const term = busqueda.toLowerCase().trim();
    if (!term) return formData.modulosIncluidos || [];
    return (formData.modulosIncluidos || []).filter(mod =>
      String(mod.codigo || '').toLowerCase().includes(term) ||
      String(mod.descripcion || '').toLowerCase().includes(term) ||
      String(mod.gastos || '').includes(term) ||
      String(mod.honorarios || '').includes(term)
    );
  };

  const filtrarPracticas = () => {
    const term = busqueda.toLowerCase().trim();
    if (!term) return formData.practicasIncluidas || [];
    return (formData.practicasIncluidas || []).filter(prac =>
      String(prac.codigo || '').toLowerCase().includes(term) ||
      String(prac.descripcion || '').toLowerCase().includes(term) ||
      String(prac.valor || '').includes(term)
    );
  };

  const filtrarObservaciones = () => {
    const term = busqueda.toLowerCase().trim();
    if (!term) return formData.observaciones || [];
    return (formData.observaciones || []).filter(obs =>
      String(obs.titulo || '').toLowerCase().includes(term) ||
      String(obs.detalle || '').toLowerCase().includes(term)
    );
  };

  const tabs = [
    { key: 'valores', label: 'Valores Arancelarios', count: formData.valoresArancelarios?.length || 0 },
    { key: 'modulos', label: 'Módulos Incluidos', count: formData.modulosIncluidos?.length || 0 },
    { key: 'practicas', label: 'Prácticas Incluidas', count: formData.practicasIncluidas?.length || 0 },
    { key: 'observaciones', label: 'Observaciones', count: formData.observaciones?.length || 0 },
  ];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>👁 Detalle Convenio</h1>
          <p className={styles.subtitle}>
            {formData.nombreConvenio || 'Convenio'} · {formData.obraSocial?.sigla} - {formData.obraSocial?.descripcion}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button onClick={() => setEditMode(!editMode)} className={styles.btnSecondary}>
            {editMode ? 'Cancelar' : '✏️ Editar'}
          </button>
          {editMode && (
            <button onClick={handleGuardar} disabled={guardando} className={styles.btnPrimary}>
              {guardando ? 'Guardando...' : '💾 Guardar'}
            </button>
          )}
        </div>
      </header>

      {/* Buscador global */}
      <div className={styles.searchBox}>
        <input
          type="text"
          placeholder="🔎 Buscar en la pestaña activa..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className={styles.input}
        />
      </div>

      {/* Pestañas */}
      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            <span className={styles.tabCount}>{tab.count}</span>
          </button>
        ))}
      </div>

      <div className={styles.card}>
        {activeTab === 'valores' && (
          <section className={styles.section}>
            <h3>Valores Arancelarios</h3>
            {filtrarValores().length === 0 ? (
              <p className={styles.empty}>Sin resultados</p>
            ) : (
              <table className={styles.table}>
                <thead><tr><th>Concepto</th><th>Valor</th></tr></thead>
                <tbody>
                  {filtrarValores().map((item, idx) => {
                    const originalIdx = formData.valoresArancelarios?.indexOf(item);
                    return (
                      <tr key={originalIdx}>
                        <td>{item.concepto}</td>
                        <td>
                          {editMode ? (
                            <input
                              type="number"
                              value={item.valor}
                              onChange={(e) => handleChange('valoresArancelarios', originalIdx, 'valor', parseFloat(e.target.value) || 0)}
                              className={styles.inputSmall}
                            />
                          ) : (
                            item.valor.toLocaleString('es-AR')
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        )}

        {activeTab === 'modulos' && (
          <section className={styles.section}>
            <h3>Módulos Incluidos</h3>
            {filtrarModulos().length === 0 ? (
              <p className={styles.empty}>Sin resultados</p>
            ) : (
              <table className={styles.table}>
                <thead><tr><th>Código</th><th>Descripción</th><th>Gastos</th><th>Honorarios</th></tr></thead>
                <tbody>
                  {filtrarModulos().map((mod, idx) => {
                    const originalIdx = formData.modulosIncluidos?.indexOf(mod);
                    return (
                      <tr key={originalIdx}>
                        <td>{mod.codigo}</td>
                        <td>{mod.descripcion}</td>
                        <td>
                          {editMode ? (
                            <input type="number" value={mod.gastos} onChange={(e) => handleChange('modulosIncluidos', originalIdx, 'gastos', parseFloat(e.target.value) || 0)} className={styles.inputSmall} />
                          ) : mod.gastos.toLocaleString('es-AR')}
                        </td>
                        <td>
                          {editMode ? (
                            <input type="number" value={mod.honorarios} onChange={(e) => handleChange('modulosIncluidos', originalIdx, 'honorarios', parseFloat(e.target.value) || 0)} className={styles.inputSmall} />
                          ) : mod.honorarios.toLocaleString('es-AR')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        )}

        {activeTab === 'practicas' && (
          <section className={styles.section}>
            <h3>Prácticas Incluidas</h3>
            {filtrarPracticas().length === 0 ? (
              <p className={styles.empty}>Sin resultados</p>
            ) : (
              <table className={styles.table}>
                <thead><tr><th>Código</th><th>Descripción</th><th>Valor</th></tr></thead>
                <tbody>
                  {filtrarPracticas().map((prac, idx) => {
                    const originalIdx = formData.practicasIncluidas?.indexOf(prac);
                    return (
                      <tr key={originalIdx}>
                        <td>{prac.codigo}</td>
                        <td>{prac.descripcion}</td>
                        <td>
                          {editMode ? (
                            <input type="number" value={prac.valor} onChange={(e) => handleChange('practicasIncluidas', originalIdx, 'valor', parseFloat(e.target.value) || 0)} className={styles.inputSmall} />
                          ) : prac.valor.toLocaleString('es-AR')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        )}

        {activeTab === 'observaciones' && (
          <section className={styles.section}>
            <h3>Observaciones</h3>
            {filtrarObservaciones().length === 0 ? (
              <p className={styles.empty}>Sin resultados</p>
            ) : (
              filtrarObservaciones().map((obs, idx) => (
                <div key={idx} className={styles.obsItem}>
                  <strong>{obs.titulo}</strong>: {obs.detalle}
                </div>
              ))
            )}
          </section>
        )}
      </div>
    </div>
  );
}