import styles from "../page.module.css";
import { PROVEEDORES } from "../utils/proveedores";

export default function PasoDestinatarios({ selectedArts, tab, destinatariosOff, toggleDestinatario, toggleAllDestinatarios }) {
  const contactos = [];
  selectedArts.forEach(id => {
    const art = PROVEEDORES.find(p => p.id === id);
    if (art) {
      const list = tab === "siniestros" ? art.siniestros : art.facturacion;
      list.forEach(c => contactos.push({ ...c, artId: id }));
    }
  });
  const unicos = contactos.filter((c, i, arr) => arr.findIndex(x => x.email === c.email) === i);

  const isActive = (i) => destinatariosOff[`${i}`] !== true;
  const activos = unicos.filter((_, i) => isActive(i));

  return (
    <div className={styles.recipientsCard}>
      <div className={styles.recipientsTop}>
        <p className={styles.blockLabel}>📧 Destinatarios</p>
        {unicos.length > 0 && (
          <div className={styles.toggleRow}>
            <button className={styles.tinyBtn} onClick={() => toggleAllDestinatarios(true)}>Todos</button>
            <button className={styles.tinyBtn} onClick={() => toggleAllDestinatarios(false)}>Ninguno</button>
          </div>
        )}
      </div>
      {selectedArts.size === 0 ? (
        <div className={styles.emptyState}><span className={styles.emptyStateIcon}>👈</span><p>Seleccioná una ART</p></div>
      ) : unicos.length === 0 ? (
        <div className={styles.emptyState}><span className={styles.emptyStateIcon}>📭</span><p>Sin contactos</p></div>
      ) : (
        <ul className={styles.recipientsList}>
          {unicos.map((c, i) => (
            <li key={c.email}>
              <label className={`${styles.recipientRow} ${isActive(i) ? styles.recipientRowOn : ""}`}>
                <input type="checkbox" className={styles.chk} checked={isActive(i)} onChange={() => toggleDestinatario(i)} />
                <span className={styles.recipientData}>
                  <span className={styles.recipientNombre}>{c.nombre}</span>
                  <span className={styles.recipientEmail}>{c.email}</span>
                </span>
                {isActive(i) && <span className={styles.recipientCheck}>✓</span>}
              </label>
            </li>
          ))}
        </ul>
      )}
      {activos.length > 0 && <p className={styles.selCount}>{activos.length} activo{activos.length !== 1 ? "s" : ""}</p>}
    </div>
  );
}