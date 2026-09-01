import styles from "../cx-common.module.css";
import {
  formatNumberWithThousands,
  fmtDate,
  daysUntil,
  getDoctor,
  preopStatus,
} from "../_utils/helpers";

export default function CirugiaCard({
  cx,
  onRealizar,
  onEditar,
  onEliminar,
  onVerFicha,
  onEstudioClick,
  onDownloadFrente,
}) {
  const dr = getDoctor(cx);
  const preop = preopStatus(cx);
  const dias = daysUntil(cx.fechaEstimada);
  const esHoy = dias === 0;
  const esMañana = dias === 1;
  const esProximo = dias !== null && dias >= 0 && dias <= 3;

  let urgencyClass = "";
  if (esHoy) urgencyClass = styles.cardHoy;
  else if (esMañana) urgencyClass = styles.cardMañana;
  else if (esProximo) urgencyClass = styles.cardProximo;

  return (
    <div className={`${styles.cxCard} ${urgencyClass}`}>
      {esHoy && <div className={styles.urgencyBanner}>HOY</div>}
      {esMañana && <div className={`${styles.urgencyBanner} ${styles.bannerMañana}`}>MAÑANA</div>}

      <div className={styles.cardTop}>
        <div>
          <span className={styles.cardPatientName}>
            {cx.pacienteDatos?.apellido} {cx.pacienteDatos?.nombre}
          </span>
          {cx.pacienteDatos?.dni && (
            <span className={styles.dniBadge}>
              DNI {formatNumberWithThousands(cx.pacienteDatos.dni)}
            </span>
          )}
        </div>
        {!preop.completo && (
          <span className={styles.alertBadge} title="Preoperatorio incompleto">
            ⚠️ Preop incompleto
          </span>
        )}
      </div>

      <div className={styles.cardCx}>{cx.formulario?.cx || "—"}</div>

      <div className={styles.cardMeta}>
        <span>
          <span className={styles.metaIcon}>👨‍⚕️</span>
          {dr ? `Dr. ${dr}` : "Sin médico"}
        </span>
        <span>
          <span className={styles.metaIcon}>📅</span>
          {fmtDate(cx.fechaEstimada)}
          {dias !== null && dias >= 0 && (
            <span
              className={`${styles.diasChip} ${
                esHoy ? styles.chipHoy : esProximo ? styles.chipProximo : ""
              }`}
            >
              {dias === 0 ? "Hoy" : `${dias}d`}
            </span>
          )}
        </span>
      </div>

      <div className={styles.cardPreop}>
        <div
          className={`${styles.preopItem} ${
            preop.ecg ? styles.preopOk : styles.preopWarn
          } ${styles.clickable}`}
          onClick={() => onEstudioClick(cx, "ecg")}
        >
          <span>🫀 ECG</span>
          {preop.ecg ? (
            <span>
              {cx.ecgProfesional} · {fmtDate(cx.ecgFecha)}
            </span>
          ) : (
            <span>Pendiente</span>
          )}
        </div>
        <div
          className={`${styles.preopItem} ${
            preop.lab ? styles.preopOk : styles.preopWarn
          } ${styles.clickable}`}
          onClick={() => onEstudioClick(cx, "lab")}
        >
          <span>🧪 Lab</span>
          {preop.lab ? (
            <span>
              {cx.labProfesional} · {fmtDate(cx.labFecha)}
            </span>
          ) : (
            <span>Pendiente</span>
          )}
        </div>
      </div>

      <div className={styles.cardActions}>
        <button className={styles.actionPdf} onClick={() => onDownloadFrente(cx)}>
          📄 PDF
        </button>
        <button className={styles.actionView} onClick={() => onVerFicha(cx)}>
          📋 Ficha
        </button>
        <button className={styles.actionEdit} onClick={() => onEditar(cx)}>
          ✏️ Editar
        </button>
        <button className={styles.actionDone} onClick={() => onRealizar(cx)}>
          ✅ Realizada
        </button>
        <button className={styles.actionDelete} onClick={() => onEliminar(cx.id)}>
          🗑
        </button>
      </div>
    </div>
  );
}