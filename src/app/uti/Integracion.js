/**
 * GUÍA DE INTEGRACIÓN — UTI
 * Nuevas funcionalidades: DNI, Exámenes, Pendientes
 * ─────────────────────────────────────────────────
 * Este archivo muestra cómo integrar cada nueva feature
 * en tus componentes React existentes.
 */

// ═══════════════════════════════════════════════════════
// 1. TIPOS / SHAPES DE DATOS
// ═══════════════════════════════════════════════════════

/**
 * Paciente — agregar campo dni
 *
 * Antes:
 * { nombre, fechaIngreso, medico, obraSocial, ... }
 *
 * Ahora:
 */
const PACIENTE_SHAPE = {
  nombre: "",
  dni: "",            // ← NUEVO: string, p.ej. "28.345.678"
  fechaIngreso: "",
  medico: "",
  obraSocial: "",
  diagnostico: "",
  antecedentes: "",
  // ... resto de campos existentes
};

/**
 * Examen — nuevo tipo de registro (similar a evolución)
 */
const EXAMEN_SHAPE = {
  tipo: "",             // "Tomografía" | "Rx" | "Laboratorio" | "Ecografía" | "ECG" | "RMN" | "Otro"
  fechaExamen: "",      // fecha clínica del estudio (ISO string)
  informe: "",          // texto libre del informe
  linkEstudio: "",      // URL del PACS / sistema de imágenes
  medico: "",           // quien lo solicita/carga
  fechaCarga: "",       // timestamp de carga (ISO string)
  ingresoId: "",        // ID del ingreso al que pertenece
  pacienteId: "",       // ID del paciente
};

/**
 * Pendiente — nuevo tipo de registro
 */
const PENDIENTE_SHAPE = {
  descripcion: "",      // texto del pendiente
  tipo: "examen",       // "examen" | "evolucion" | "alerta" | "otro"
  resuelto: false,      // bool
  fechaCreacion: "",    // ISO string
  fechaResolucion: "",  // ISO string, vacío si no resuelto
  cama: "",             // número de cama
  ingresoId: "",        // ID del ingreso
  pacienteId: "",       // ID del paciente
  nombrePaciente: "",   // desnormalizado para la vista global
  dniPaciente: "",      // desnormalizado para la vista global
  medico: "",           // quien lo cargó
};

// ═══════════════════════════════════════════════════════
// 2. FIREBASE — RUTAS DE DATOS
// ═══════════════════════════════════════════════════════

/**
 * Estructura recomendada en Firebase Realtime Database:
 *
 * UTI/
 *   {pacienteId}/
 *     dni: "28.345.678"
 *     nombre: "García, Juan"
 *     ingresos/
 *       {ingresoId}/
 *         fechaIngreso: "..."
 *         evoluciones/
 *           {evoId}/
 *             texto: "..."
 *             fechaClinica: "..."
 *         examenes/                    ← NUEVO
 *           {examenId}/
 *             tipo: "Tomografía"
 *             fechaExamen: "..."
 *             informe: "..."
 *             linkEstudio: "https://..."
 *         pendientes/                  ← NUEVO
 *           {pendienteId}/
 *             descripcion: "Esperar resultado TAC"
 *             resuelto: false
 *             tipo: "examen"
 */

// ═══════════════════════════════════════════════════════
// 3. COMPONENTE — CAMPO DNI EN FORMULARIO DE INGRESO
// ═══════════════════════════════════════════════════════

/**
 * Agregar en el fieldsGrid de tu formulario principal,
 * junto a los otros datos del paciente:
 */
const DNI_FIELD_JSX = `
<div className={s.fieldGroup}>
  <label className={s.fieldLabel}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <line x1="2" y1="10" x2="22" y2="10"/>
    </svg>
    DNI
  </label>
  <input
    className={s.fieldInput}
    value={form.dni || ""}
    onChange={e => setForm(f => ({ ...f, dni: e.target.value }))}
    placeholder="Ej: 28.345.678"
    maxLength={12}
  />
</div>
`;

// ═══════════════════════════════════════════════════════
// 4. COMPONENTE — TAB "EXÁMENES" EN EL FORMULARIO
// ═══════════════════════════════════════════════════════

/**
 * Agregar en el tabBar del formPanel (junto a "Datos", "Evolución", etc.)
 * y el contenido del tab:
 */
const EXAMENES_TAB_JSX = `
{/* En el tabBar */}
<button
  className={[s.tab, activeTab === "examenes" ? s.tabActive : ""].join(" ")}
  onClick={() => setActiveTab("examenes")}
>
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14,2 14,8 20,8"/>
    <line x1="12" y1="18" x2="12" y2="12"/>
    <line x1="9" y1="15" x2="15" y2="15"/>
  </svg>
  Exámenes
  {examenes.length > 0 && (
    <span className={\`\${s.tabBadge} \${s.tabBadgeBlue}\`}>{examenes.length}</span>
  )}
</button>

{/* Contenido del tab "examenes" */}
{activeTab === "examenes" && (
  <div className={s.formBody}>

    {/* Formulario de nuevo examen */}
    <div className={s.examenForm}>
      <h4 className={s.examenFormTitle}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="16"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
        Cargar nuevo examen
      </h4>

      {/* Tipo de examen */}
      <div className={s.fieldGroup}>
        <span className={s.fieldLabel}>Tipo de estudio</span>
        <div className={s.tipoExamenGrid}>
          {TIPOS_EXAMEN.map(tipo => (
            <button
              key={tipo.valor}
              type="button"
              className={[
                s.tipoExamenBtn,
                examenForm.tipo === tipo.valor ? s.tipoExamenBtnActive : ""
              ].join(" ")}
              onClick={() => setExamenForm(f => ({ ...f, tipo: tipo.valor }))}
            >
              <span className={s.tipoExamenIcon}>{tipo.icono}</span>
              {tipo.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fecha del examen */}
      <div className={s.fieldsGrid}>
        <div className={s.fieldGroup}>
          <label className={s.fieldLabel}>Fecha del estudio</label>
          <input
            type="date"
            className={s.fieldInput}
            value={examenForm.fechaExamen}
            onChange={e => setExamenForm(f => ({ ...f, fechaExamen: e.target.value }))}
          />
        </div>
        <div className={s.fieldGroup}>
          <label className={s.fieldLabel}>
            Médico solicitante
            <span className={s.labelNote}>(opcional)</span>
          </label>
          <input
            className={s.fieldInput}
            value={examenForm.medico}
            onChange={e => setExamenForm(f => ({ ...f, medico: e.target.value }))}
            placeholder="Dr. ..."
          />
        </div>
      </div>

      {/* Informe */}
      <div className={s.fieldGroup}>
        <label className={s.fieldLabel}>Informe / Resultado</label>
        <textarea
          className={\`\${s.fieldInput} \${s.fieldTextarea} \${s.fieldTextareaLg}\`}
          value={examenForm.informe}
          onChange={e => setExamenForm(f => ({ ...f, informe: e.target.value }))}
          placeholder="Transcribir o resumir el informe del estudio..."
        />
      </div>

      {/* Link del estudio */}
      <div className={s.fieldGroup}>
        <label className={s.fieldLabel}>
          Link del estudio / imágenes
          <span className={s.labelNote}>(opcional)</span>
        </label>
        <div className={s.examenLinkInput}>
          <span className={s.examenLinkIcon}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
          </span>
          <input
            className={s.examenLinkField}
            value={examenForm.linkEstudio}
            onChange={e => setExamenForm(f => ({ ...f, linkEstudio: e.target.value }))}
            placeholder="https://pacs.hospital.com/estudio/..."
          />
          {examenForm.linkEstudio && (
            <button
              type="button"
              className={s.examenLinkOpenBtn}
              onClick={() => window.open(examenForm.linkEstudio, "_blank")}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15,3 21,3 21,9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Abrir
            </button>
          )}
        </div>
      </div>

      {/* Acción guardar examen */}
      <div className={s.formActions} style={{ paddingTop: "0.75rem" }}>
        <div />
        <div className={s.formActionsRight}>
          <button
            type="button"
            className={\`\${s.btn} \${s.btnGhost}\`}
            onClick={() => setExamenForm(EXAMEN_FORM_INICIAL)}
          >
            Limpiar
          </button>
          <button
            type="button"
            className={\`\${s.btn} \${s.btnTeal}\`}
            onClick={handleGuardarExamen}
            disabled={!examenForm.tipo || !examenForm.informe.trim()}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17,21 17,13 7,13 7,21"/>
              <polyline points="7,3 7,8 15,8"/>
            </svg>
            Guardar examen
          </button>
        </div>
      </div>
    </div>

    {/* Lista de exámenes anteriores */}
    {examenes.length > 0 && (
      <>
        <div className={s.fieldLabel} style={{ marginTop: "0.5rem" }}>
          Exámenes cargados ({examenes.length})
        </div>
        <div className={s.examenHistList}>
          {examenes.map((ex, i) => (
            <div key={i} className={s.examenHistItem}>
              <div className={s.examenHistHeader}>
                <span className={s.examenTipoBadge}>{ex.tipo}</span>
                <span className={s.examenHistDate}>{formatFecha(ex.fechaExamen)}</span>
                {ex.medico && (
                  <span className={s.examenHistDoc}>{ex.medico}</span>
                )}
              </div>
              {ex.informe && (
                <p className={s.examenHistText}>{ex.informe}</p>
              )}
              {ex.linkEstudio && (
                <a
                  href={ex.linkEstudio}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={s.examenHistLink}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15,3 21,3 21,9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  Ver imágenes / estudio
                </a>
              )}
            </div>
          ))}
        </div>
      </>
    )}
  </div>
)}
`;

// ═══════════════════════════════════════════════════════
// 5. COMPONENTE — TAB "PENDIENTES" EN EL FORMULARIO
// ═══════════════════════════════════════════════════════

const PENDIENTES_TAB_JSX = `
{/* En el tabBar */}
<button
  className={[s.tab, activeTab === "pendientes" ? s.tabActive : ""].join(" ")}
  onClick={() => setActiveTab("pendientes")}
>
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 11l3 3L22 4"/>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
  Pendientes
  {pendientesActivos.length > 0 && (
    <span className={\`\${s.tabBadge} \${s.tabBadgeAmber}\`}>{pendientesActivos.length}</span>
  )}
</button>

{/* Contenido del tab "pendientes" */}
{activeTab === "pendientes" && (
  <div className={s.formBody} style={{ padding: 0 }}>

    {/* Lista de pendientes */}
    <div className={s.pendientesContainer}>
      <div className={s.pendientesSectionHeader}>
        <p className={s.pendientesSectionTitle}>Pendientes activos</p>
        {pendientesActivos.length > 0 && (
          <span className={s.pendientesCount}>{pendientesActivos.length}</span>
        )}
      </div>

      {pendientesActivos.length === 0 ? (
        <div className={s.pendientesEmpty}>
          <div className={s.pendientesEmptyIcon}>✓</div>
          <p className={s.pendientesEmptyTitle}>Sin pendientes</p>
          <p className={s.pendientesEmptyDesc}>No hay estudios ni tareas pendientes para este paciente.</p>
        </div>
      ) : (
        pendientesActivos.map((p, i) => (
          <div key={i} className={s.pendienteItem}>
            <div
              className={[
                s.pendienteCheckbox,
                p.resuelto ? s.pendienteCheckboxResuelto : ""
              ].join(" ")}
              onClick={() => togglePendiente(p.id)}
              title={p.resuelto ? "Marcar como pendiente" : "Marcar como resuelto"}
            >
              {p.resuelto && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                  <polyline points="20,6 9,17 4,12"/>
                </svg>
              )}
            </div>
            <div className={s.pendienteContent}>
              <div className={s.pendienteHeader}>
                <span className={[
                  s.pendienteTipoBadge,
                  p.tipo === "examen" ? s.pendienteBadgeExamen :
                  p.tipo === "evolucion" ? s.pendienteBadgeEvol :
                  s.pendienteBadgeAlerta
                ].join(" ")}>
                  {p.tipo === "examen" ? "Examen" :
                   p.tipo === "evolucion" ? "Evolución" : "Alerta"}
                </span>
              </div>
              <p className={[
                s.pendienteDescripcion,
                p.resuelto ? s.pendienteResueltoText : ""
              ].join(" ")}>
                {p.descripcion}
              </p>
              <div className={s.pendienteMeta}>
                <span className={s.pendienteFecha}>
                  {formatFecha(p.fechaCreacion)}
                </span>
                {p.resuelto && p.fechaResolucion && (
                  <span className={s.pendienteFecha} style={{ color: "var(--green-600)" }}>
                    ✓ Resuelto {formatFecha(p.fechaResolucion)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))
      )}

      {/* Pendientes resueltos colapsados */}
      {pendientesResueltos.length > 0 && (
        <>
          <div className={s.pendientesSectionHeader} style={{ marginTop: "0.5rem" }}>
            <p className={s.pendientesSectionTitle}>Resueltos ({pendientesResueltos.length})</p>
          </div>
          {pendientesResueltos.map((p, i) => (
            <div key={i} className={s.pendienteItem} style={{ opacity: 0.6 }}>
              <div className={[s.pendienteCheckbox, s.pendienteCheckboxResuelto].join(" ")}
                onClick={() => togglePendiente(p.id)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                  <polyline points="20,6 9,17 4,12"/>
                </svg>
              </div>
              <div className={s.pendienteContent}>
                <p className={[s.pendienteDescripcion, s.pendienteResueltoText].join(" ")}>
                  {p.descripcion}
                </p>
              </div>
            </div>
          ))}
        </>
      )}
    </div>

    {/* Formulario para agregar nuevo pendiente */}
    <div className={s.pendienteNuevoForm}>
      <select
        className={s.fieldInput}
        value={nuevoPendiente.tipo}
        onChange={e => setNuevoPendiente(f => ({ ...f, tipo: e.target.value }))}
        style={{ minWidth: "120px", maxWidth: "150px", flex: "none" }}
      >
        <option value="examen">Examen</option>
        <option value="evolucion">Evolución</option>
        <option value="alerta">Alerta</option>
        <option value="otro">Otro</option>
      </select>
      <input
        className={s.pendienteNuevoInput}
        value={nuevoPendiente.descripcion}
        onChange={e => setNuevoPendiente(f => ({ ...f, descripcion: e.target.value }))}
        onKeyDown={e => e.key === "Enter" && handleAgregarPendiente()}
        placeholder="Ej: Esperar resultado de TAC de tórax..."
      />
      <button
        type="button"
        className={s.pendienteAddBtn}
        onClick={handleAgregarPendiente}
        disabled={!nuevoPendiente.descripcion.trim()}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Agregar
      </button>
    </div>
  </div>
)}
`;

// ═══════════════════════════════════════════════════════
// 6. VISTA GLOBAL DE PENDIENTES (nueva vista en adminNavBtn)
// ═══════════════════════════════════════════════════════

/**
 * Agregar "Pendientes" como vista en la navegación principal.
 * Esta vista muestra todos los pendientes de TODOS los pacientes activos.
 *
 * En adminTopbarCenter, agregar:
 */
const PENDIENTES_NAV_BTN_JSX = `
<button
  className={[s.adminNavBtn, vista === "pendientes" ? s.adminNavBtnActive : ""].join(" ")}
  onClick={() => setVista("pendientes")}
>
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 11l3 3L22 4"/>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
  Pendientes
  {totalPendientesActivos > 0 && (
    <span className={s.tabBadgeAmber} style={{
      background: "var(--amber-100)",
      color: "var(--amber-700)",
      borderRadius: "999px",
      fontSize: "0.65rem",
      fontWeight: 800,
      padding: "0.1rem 0.4rem",
    }}>
      {totalPendientesActivos}
    </span>
  )}
</button>
`;

/**
 * Vista "pendientes" global — estructura del componente:
 *
 * Agrupa todos los pendientes por paciente/cama.
 * Muestra:
 *   - Nombre + DNI del paciente
 *   - Cama
 *   - Lista de pendientes (con toggle para resolver)
 */
const VISTA_PENDIENTES_JSX = `
{vista === "pendientes" && (
  <div className={s.contentPanel}>
    <div className={s.filtersBar}>
      <div className={s.searchBox}>
        <svg className={s.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className={s.searchInput}
          placeholder="Buscar por paciente o descripción..."
          value={searchPendientes}
          onChange={e => setSearchPendientes(e.target.value)}
        />
      </div>
      <div className={s.filterTabs}>
        {["todos", "examen", "evolucion", "alerta"].map(f => (
          <button
            key={f}
            className={[s.filterTab, filtroPendiente === f ? s.filterTabActive : ""].join(" ")}
            onClick={() => setFiltroPendiente(f)}
          >
            {f === "todos" ? "Todos" :
             f === "examen" ? "Exámenes" :
             f === "evolucion" ? "Evoluciones" : "Alertas"}
          </button>
        ))}
      </div>
    </div>

    {pendientesFiltrados.length === 0 ? (
      <div className={s.pendientesEmpty}>
        <div className={s.pendientesEmptyIcon}>✓</div>
        <p className={s.pendientesEmptyTitle}>Sin pendientes activos</p>
        <p className={s.pendientesEmptyDesc}>
          Todos los estudios y tareas están al día.
        </p>
      </div>
    ) : (
      <div className={s.pendientesContainer}>
        {pendientesFiltrados.map((p, i) => (
          <div key={i} className={s.pendienteItem}>
            <div
              className={[
                s.pendienteCheckbox,
                p.resuelto ? s.pendienteCheckboxResuelto : ""
              ].join(" ")}
              onClick={() => togglePendienteGlobal(p)}
            >
              {p.resuelto && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                  <polyline points="20,6 9,17 4,12"/>
                </svg>
              )}
            </div>
            <div className={s.pendienteContent}>
              <div className={s.pendienteHeader}>
                <span className={s.pendientePaciente}>{p.nombrePaciente}</span>
                {p.dniPaciente && (
                  <span className={s.pendienteDni}>DNI {p.dniPaciente}</span>
                )}
                <span className={[
                  s.pendienteTipoBadge,
                  p.tipo === "examen" ? s.pendienteBadgeExamen :
                  p.tipo === "evolucion" ? s.pendienteBadgeEvol :
                  s.pendienteBadgeAlerta
                ].join(" ")}>
                  {p.tipo}
                </span>
                <span className={s.pendienteCama}>Cama {p.cama}</span>
              </div>
              <p className={[
                s.pendienteDescripcion,
                p.resuelto ? s.pendienteResueltoText : ""
              ].join(" ")}>
                {p.descripcion}
              </p>
              <div className={s.pendienteMeta}>
                <span className={s.pendienteFecha}>
                  Creado: {formatFecha(p.fechaCreacion)}
                </span>
                {p.medico && (
                  <span className={s.pendienteFecha}>por {p.medico}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
)}
`;

// ═══════════════════════════════════════════════════════
// 7. EXPEDIENTE — TABS INTERNAS (Evoluciones / Exámenes / Pendientes)
// ═══════════════════════════════════════════════════════

/**
 * En la vista de expediente del paciente, agregar tabs
 * para navegar entre Evoluciones, Exámenes y Pendientes.
 */
const EXPEDIENTE_TABS_JSX = `
{/* Tabs de sección en expediente */}
<div className={s.expedienteTabBar}>
  <button
    className={[s.expedienteTab, expTab === "evoluciones" ? s.expedienteTabActive : ""].join(" ")}
    onClick={() => setExpTab("evoluciones")}
  >
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
    Evoluciones
    <span className={s.tabBadge}>{totalEvoluciones}</span>
  </button>

  <button
    className={[s.expedienteTab, expTab === "examenes" ? s.expedienteTabActive : ""].join(" ")}
    onClick={() => setExpTab("examenes")}
  >
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
      <line x1="12" y1="18" x2="12" y2="12"/>
      <line x1="9" y1="15" x2="15" y2="15"/>
    </svg>
    Exámenes
    <span className={[s.tabBadge, totalExamenes > 0 ? s.tabBadgeBlue : ""].join(" ")}>
      {totalExamenes}
    </span>
  </button>

  <button
    className={[s.expedienteTab, expTab === "pendientes" ? s.expedienteTabActive : ""].join(" ")}
    onClick={() => setExpTab("pendientes")}
  >
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11l3 3L22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
    Pendientes
    <span className={[s.tabBadge, pendientesActivos > 0 ? s.tabBadgeAmber : ""].join(" ")}>
      {pendientesActivos}
    </span>
  </button>
</div>
`;

// ═══════════════════════════════════════════════════════
// 8. DATOS CONSTANTES — TIPOS DE EXAMEN
// ═══════════════════════════════════════════════════════

export const TIPOS_EXAMEN = [
  { valor: "Laboratorio",   label: "Laboratorio",  icono: "🧪" },
  { valor: "Rx",            label: "Rx",           icono: "🫁" },
  { valor: "Tomografía",    label: "Tomografía",   icono: "🖥️" },
  { valor: "Ecografía",     label: "Ecografía",    icono: "📡" },
  { valor: "ECG",           label: "ECG",          icono: "💓" },
  { valor: "RMN",           label: "RMN",          icono: "🧲" },
  { valor: "Endoscopía",    label: "Endoscopía",   icono: "🔬" },
  { valor: "Otro",          label: "Otro",         icono: "📋" },
];

// ═══════════════════════════════════════════════════════
// 9. HANDLERS — LÓGICA DE NEGOCIO
// ═══════════════════════════════════════════════════════

/**
 * Guardar un nuevo examen en Firebase
 */
async function handleGuardarExamen() {
  if (!examenForm.tipo || !examenForm.informe.trim()) return;

  const nuevoExamen = {
    ...examenForm,
    fechaCarga: new Date().toISOString(),
    medico: examenForm.medico || usuarioActual,
    pacienteId: pacienteId,
    ingresoId: ingresoActivo.id,
  };

  const result = await save({
    editId: null,
    data: { [`UTI/${pacienteId}/ingresos/${ingresoActivo.id}/examenes`]: nuevoExamen },
  });

  if (result.ok) {
    setExamenes(prev => [nuevoExamen, ...prev]);
    setExamenForm(EXAMEN_FORM_INICIAL);
    // Si es un estudio pendiente de resultado, auto-crear pendiente
    if (examenForm.tipo !== "Laboratorio" || !examenForm.informe.trim()) {
      // Opcional: pre-completar pendiente con nombre del estudio
    }
  }
}

/**
 * Agregar un pendiente nuevo
 */
async function handleAgregarPendiente() {
  if (!nuevoPendiente.descripcion.trim()) return;

  const p = {
    descripcion: nuevoPendiente.descripcion.trim(),
    tipo: nuevoPendiente.tipo,
    resuelto: false,
    fechaCreacion: new Date().toISOString(),
    fechaResolucion: "",
    cama: camaActual,
    ingresoId: ingresoActivo.id,
    pacienteId: pacienteId,
    nombrePaciente: paciente.nombre,
    dniPaciente: paciente.dni || "",
    medico: usuarioActual,
  };

  const result = await save({
    editId: null,
    data: { [`UTI/${pacienteId}/pendientes`]: p },
  });

  if (result.ok) {
    setPendientes(prev => [p, ...prev]);
    setNuevoPendiente({ descripcion: "", tipo: "examen" });
  }
}

/**
 * Toggle: resolver / reabrir un pendiente
 */
async function togglePendiente(pendienteId) {
  const p = pendientes.find(x => x.id === pendienteId);
  if (!p) return;

  const actualizado = {
    ...p,
    resuelto: !p.resuelto,
    fechaResolucion: !p.resuelto ? new Date().toISOString() : "",
  };

  await save({
    editId: `UTI/${pacienteId}/pendientes/${pendienteId}`,
    data: actualizado,
  });

  setPendientes(prev =>
    prev.map(x => x.id === pendienteId ? actualizado : x)
  );
}

// ═══════════════════════════════════════════════════════
// 10. MOSTRAR DNI EN BED CARD
// ═══════════════════════════════════════════════════════

/**
 * En la bedCard, debajo del nombre del paciente, agregar:
 */
const BED_CARD_DNI_JSX = `
{/* Dentro de bedBody, debajo de bedName */}
{paciente.dni && (
  <p className={s.bedDni}>DNI {paciente.dni}</p>
)}
`;

// ═══════════════════════════════════════════════════════
// 11. MOSTRAR DNI EN TABLA DE PACIENTES
// ═══════════════════════════════════════════════════════

/**
 * En la tabla, agregar columna DNI (o como sub-texto en la celda Paciente):
 */
const TABLA_DNI_JSX = `
{/* Opción A: columna separada */}
<th>DNI</th>
{/* ... */}
<td className={s.tdDni}>{paciente.dni || "—"}</td>

{/* Opción B: sub-texto en la misma celda (recomendada, ahorra espacio) */}
<td>
  <div className={s.tdPaciente}>{paciente.nombre}</div>
  {paciente.dni && (
    <div className={s.tdDni}>DNI {paciente.dni}</div>
  )}
</td>
`;

// ═══════════════════════════════════════════════════════
// 12. MOSTRAR DNI EN EXPEDIENTE / RESUMEN
// ═══════════════════════════════════════════════════════

/**
 * En el topbar del expediente, debajo del nombre:
 */
const EXPEDIENTE_DNI_JSX = `
<div className={s.expedienteTopbarCenter}>
  <h1 className={s.expedienteNombre}>{paciente.nombre}</h1>
  {paciente.dni && (
    <p className={s.expedienteDni}>DNI {paciente.dni}</p>
  )}
  <p className={s.expedienteMeta}>
    Ingresado {formatFecha(ingresoActivo.fechaIngreso)}
  </p>
</div>
`;

/**
 * En el resumen, agregar dni en el campo de datos:
 */
const RESUMEN_DNI_JSX = `
<div className={s.resField}>
  <span className={s.resFieldLabel}>DNI</span>
  <span className={s.resFieldValue}>{paciente.dni || "No registrado"}</span>
</div>
`;