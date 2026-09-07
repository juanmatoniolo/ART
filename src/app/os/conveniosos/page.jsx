'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ref, onValue, remove } from 'firebase/database';
import { db } from '@/lib/firebase';
import styles from './conveniosos.module.css';

export default function ConveniosPage() {
  const [convenios, setConvenios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [eliminandoId, setEliminandoId] = useState(null);
  const [modalEliminar, setModalEliminar] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const refConv = ref(db, 'facturacionOS/convenios');
    const unsub = onValue(refConv, (snap) => {
      const data = snap.val();
      const lista = data
        ? Object.entries(data).map(([id, value]) => ({ id, ...value }))
        : [];
      lista.sort((a, b) => new Date(b.fechaCarga) - new Date(a.fechaCarga));
      setConvenios(lista);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const confirmarEliminacion = async () => {
    if (!modalEliminar) return;
    const { id } = modalEliminar;
    setEliminandoId(id);
    try {
      await remove(ref(db, `facturacionOS/convenios/${id}`));
      setModalEliminar(null);
    } catch (err) {
      console.error('Error al eliminar:', err);
      alert('No se pudo eliminar el convenio.');
    } finally {
      setEliminandoId(null);
    }
  };

  const abrirModalEliminar = (id, nombre) => {
    setModalEliminar({ id, nombre });
  };

  const handleVer = (id) => {
    router.push(`/os/conveniosos/${encodeURIComponent(id)}`);
  };

  const handleEditar = (id) => {
    router.push(`/os/conveniosos/${encodeURIComponent(id)}?edit=1`);
  };

  if (loading) {
    return <div className={styles.container}>Cargando convenios...</div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>📄 Convenios</h1>
        <Link href="/os/conveniosos/cargar" className={styles.btnPrimary}>
          ➕ Cargar Excel
        </Link>
      </header>

      {convenios.length === 0 ? (
        <p className={styles.empty}>No hay convenios cargados.</p>
      ) : (
        <div className={styles.grid}>
          {convenios.map((conv) => (
            <div key={conv.id} className={styles.card}>
              <div className={styles.cardInfo}>
                <h2 className={styles.cardTitle}>
                  {conv.nombreConvenio || 'Convenio'} · {conv.obraSocial?.sigla || 'Sin sigla'}
                </h2>
                <p className={styles.cardDate}>
                  {conv.obraSocial?.descripcion || 'Sin descripción'}
                </p>
                <p className={styles.cardDate}>
                  Cargado: {new Date(conv.fechaCarga).toLocaleDateString('es-AR')}
                </p>
                <p className={styles.cardStats}>
                  Valores: {conv.valoresArancelarios?.length || 0} · Módulos: {conv.modulosIncluidos?.length || 0} · Prácticas: {conv.practicasIncluidas?.length || 0} · Obs: {conv.observaciones?.length || 0}
                </p>
              </div>
              <div className={styles.cardActions}>
                <button
                  className={styles.btnView}
                  onClick={() => handleVer(conv.id)}
                  title="Ver convenio"
                >
                  👁 Ver
                </button>
                <button
                  className={styles.btnEdit}
                  onClick={() => handleEditar(conv.id)}
                  title="Editar convenio"
                >
                  ✏️ Editar
                </button>
                <button
                  className={styles.btnDanger}
                  onClick={() => abrirModalEliminar(conv.id, conv.nombreConvenio || conv.obraSocial?.sigla)}
                  disabled={eliminandoId === conv.id}
                  title="Eliminar convenio"
                >
                  {eliminandoId === conv.id ? 'Eliminando…' : '🗑️ Eliminar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de confirmación */}
      {modalEliminar && (
        <div className={styles.modalOverlay} onClick={() => setModalEliminar(null)}>
          <div className={styles.modalConfirm} onClick={(e) => e.stopPropagation()}>
            <h3>¿Eliminar convenio?</h3>
            <p>
              Vas a eliminar <strong>{modalEliminar.nombre}</strong>.<br />
              Esta acción no se puede deshacer.
            </p>
            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={() => setModalEliminar(null)}>
                Cancelar
              </button>
              <button className={styles.btnDanger} onClick={confirmarEliminacion}>
                🗑️ Eliminar definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}