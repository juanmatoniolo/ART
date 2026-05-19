"use client";

import { useEffect, useMemo, useState } from "react";
import { ref, onValue, push, set, update, runTransaction } from "firebase/database";
import Fuse from "fuse.js";
import { db } from "../../lib/firebase";
import styles from "./historias.module.css";
import Header from "@/components/Header/Header";

const ITEMS_PER_PAGE = 20;

const USERS_PATH = "users";
const HC_PATH = "historias-clinicas";
const HC_UTI_PATH = "historias-clinica-uti";
const COUNTER_GENERAL_PATH = "counters/historias-clinicas/lastNumber";
const COUNTER_UTI_PATH = "counters/historias-clinica-uti/lastNumber";

const normalizeText = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const normalizeUser = (value = "") => normalizeText(value).toLowerCase();

const parseHCNumber = (item) => {
  const raw =
    item?.historia_clinica ??
    item?.historia_clinica_1 ??
    item?.historiaClinica ??
    item?.hc ??
    "";

  const onlyDigits = String(raw).replace(/\D/g, "");
  return onlyDigits ? Number(onlyDigits) : null;
};

const formatDni = (value = "") => {
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "-";
  return new Intl.NumberFormat("es-AR").format(Number(digits));
};

const formatHC = (value = "") => {
  const digits = String(value).replace(/\D/g, "");
  return digits || "-";
};

const mapHistoriaGeneral = (id, values = {}) => ({
  id,
  source: HC_PATH,
  nombre_apellido: values.nombre_apellido || values.nombre || "",
  dni: values.dni || values.documento || "",
  historia_clinica: values.historia_clinica || values.historia_clinica_1 || "",
  alertas: Array.isArray(values.alertas) ? values.alertas : [],
  createdBy: values.createdBy || values.creadoPor || "",
  createdAt: values.createdAt || null,
  modifiedBy: values.modifiedBy || values.modificadoPor || "",
  modifiedAt: values.modifiedAt || null,
  original: values,
});

const mapHistoriaUti = (id, values = {}) => ({
  id,
  source: HC_UTI_PATH,
  nombre_apellido: values.nombre || values.nombre_apellido || "",
  dni: values.documento || values.dni || "",
  historia_clinica: values.historia_clinica_1 || values.historia_clinica || "",
  alertas: Array.isArray(values.alertas) ? values.alertas : [],
  createdBy: values.createdBy || values.creadoPor || "",
  createdAt: values.createdAt || null,
  modifiedBy: values.modifiedBy || values.modificadoPor || "",
  modifiedAt: values.modifiedAt || null,
  original: values,
});

const getUserEntries = (usersObj = {}) => {
  return Object.entries(usersObj)
    .filter(([key, value]) => key?.startsWith("usuario") && value && typeof value === "object")
    .map(([key, value]) => ({
      key,
      user: String(value.user || value.usuario || "").trim(),
      pass: String(value.pass || value.password || "").trim(),
      nombre: String(value.nombre || value.user || value.usuario || "").trim(),
      raw: value,
    }))
    .filter((item) => item.user && item.pass);
};

const filterItems = ({ items, searchTerm, searchField, showOnlyAlerts }) => {
  let results = items;

  if (searchTerm.trim()) {
    let keys = ["nombre_apellido", "dni", "historia_clinica"];
    if (searchField === "nombre") keys = ["nombre_apellido"];
    else if (searchField === "dni") keys = ["dni"];
    else if (searchField === "historia") keys = ["historia_clinica"];

    const fuse = new Fuse(items, {
      keys,
      threshold: 0.3,
      includeScore: false,
    });

    results = fuse.search(searchTerm).map((r) => r.item);
  }

  if (showOnlyAlerts) {
    results = results.filter((item) => item.alertas && item.alertas.length > 0);
  }

  return results;
};

export default function HistoriasClinicasPage() {
  const [tab, setTab] = useState("general");
  const [loading, setLoading] = useState(true);

  const [historiasGeneral, setHistoriasGeneral] = useState([]);
  const [historiasUti, setHistoriasUti] = useState([]);
  const [usersList, setUsersList] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchField, setSearchField] = useState("all");
  const [showOnlyAlerts, setShowOnlyAlerts] = useState(false);

  const [visibleGeneral, setVisibleGeneral] = useState(ITEMS_PER_PAGE);
  const [visibleUti, setVisibleUti] = useState(ITEMS_PER_PAGE);

  const [currentUser, setCurrentUser] = useState(null);
  const [loginForm, setLoginForm] = useState({
    user: "",
    pass: "",
  });

  const [nextGeneralNumber, setNextGeneralNumber] = useState("1");
  const [nextUtiNumber, setNextUtiNumber] = useState("1");

  const [formGeneral, setFormGeneral] = useState({
    nombre_apellido: "",
    dni: "",
  });

  const [formUti, setFormUti] = useState({
    nombre_apellido: "",
    dni: "",
  });

  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});

  useEffect(() => {
    const usersRef = ref(db, USERS_PATH);
    const unsubUsers = onValue(usersRef, (snapshot) => {
      const data = snapshot.val() || {};
      setUsersList(getUserEntries(data));
    });

    const generalRef = ref(db, HC_PATH);
    const unsubGeneral = onValue(generalRef, (snapshot) => {
      const data = snapshot.val() || {};
      const items = Object.entries(data)
        .map(([id, values]) => mapHistoriaGeneral(id, values))
        .sort((a, b) => (parseHCNumber(b) || 0) - (parseHCNumber(a) || 0));

      setHistoriasGeneral(items);

      const max = items
        .map((item) => parseHCNumber(item))
        .filter((n) => Number.isFinite(n))
        .reduce((acc, curr) => Math.max(acc, curr), 0);

      setNextGeneralNumber(String(max + 1));
    });

    const utiRef = ref(db, HC_UTI_PATH);
    const unsubUti = onValue(utiRef, (snapshot) => {
      const data = snapshot.val() || {};
      const items = Object.entries(data)
        .map(([id, values]) => mapHistoriaUti(id, values))
        .sort((a, b) => (parseHCNumber(b) || 0) - (parseHCNumber(a) || 0));

      setHistoriasUti(items);

      const max = items
        .map((item) => parseHCNumber(item))
        .filter((n) => Number.isFinite(n))
        .reduce((acc, curr) => Math.max(acc, curr), 0);

      setNextUtiNumber(String(max + 1));
    });

    setLoading(false);

    return () => {
      unsubUsers();
      unsubGeneral();
      unsubUti();
    };
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem("historia_user_auth");
    if (!savedUser) return;

    try {
      const parsed = JSON.parse(savedUser);
      const match = usersList.find(
        (u) =>
          normalizeUser(u.user) === normalizeUser(parsed.user) &&
          u.pass === parsed.pass
      );

      if (match) setCurrentUser(match);
      else localStorage.removeItem("historia_user_auth");
    } catch {
      localStorage.removeItem("historia_user_auth");
    }
  }, [usersList]);

  const currentItems = tab === "general" ? historiasGeneral : historiasUti;

  const filteredItems = useMemo(
    () =>
      filterItems({
        items: currentItems,
        searchTerm,
        searchField,
        showOnlyAlerts,
      }),
    [currentItems, searchTerm, searchField, showOnlyAlerts]
  );

  const visibleCount = tab === "general" ? visibleGeneral : visibleUti;
  const displayedItems = filteredItems.slice(0, visibleCount);

  const isLogged = Boolean(currentUser);

  const handleLogin = (e) => {
    e.preventDefault();

    const user = loginForm.user.trim();
    const pass = loginForm.pass.trim();

    if (!user || !pass) {
      alert("Debes completar usuario y contraseña");
      return;
    }

    const match = usersList.find(
      (item) =>
        normalizeUser(item.user) === normalizeUser(user) && item.pass === pass
    );

    if (!match) {
      alert("Usuario o contraseña incorrectos");
      return;
    }

    setCurrentUser(match);
    localStorage.setItem(
      "historia_user_auth",
      JSON.stringify({
        user: match.user,
        pass: match.pass,
      })
    );
    setLoginForm({ user: "", pass: "" });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("historia_user_auth");
  };

  const getNextHistoryNumber = async (counterPath) => {
    const counterRef = ref(db, counterPath);

    const tx = await runTransaction(counterRef, (currentValue) => {
      const currentNumber = Number(currentValue || 0);
      return currentNumber + 1;
    });

    if (!tx.committed) throw new Error("No se pudo reservar el número");
    return String(tx.snapshot.val());
  };

  const ensureNextNumber = async (reservedNumber, items, counterPath) => {
    const currentMax = items
      .map((item) => parseHCNumber(item))
      .filter((n) => Number.isFinite(n))
      .reduce((acc, curr) => Math.max(acc, curr), 0);

    const reserved = Number(reservedNumber || 0);

    if (reserved <= currentMax) {
      const counterRef = ref(db, counterPath);
      await set(counterRef, currentMax + 1);
      return String(currentMax + 1);
    }

    return String(reserved);
  };

  const handleCreateGeneral = async (e) => {
    e.preventDefault();
    if (!isLogged) return;

    if (!formGeneral.nombre_apellido.trim() || !formGeneral.dni.trim()) {
      alert("Nombre y DNI son obligatorios");
      return;
    }

    setSubmitting(true);

    try {
      let newNumber = await getNextHistoryNumber(COUNTER_GENERAL_PATH);
      newNumber = await ensureNextNumber(newNumber, historiasGeneral, COUNTER_GENERAL_PATH);

      const newRef = push(ref(db, HC_PATH));
      const now = Date.now();

      await set(newRef, {
        nombre_apellido: formGeneral.nombre_apellido.trim(),
        dni: formGeneral.dni.trim(),
        historia_clinica: newNumber,
        alertas: [],
        createdBy: currentUser.user,
        createdByUserKey: currentUser.key,
        createdAt: now,
        modifiedBy: currentUser.user,
        modifiedByUserKey: currentUser.key,
        modifiedAt: now,
      });

      setFormGeneral({ nombre_apellido: "", dni: "" });
    } catch (error) {
      console.error(error);
      alert("Error al crear historia clínica");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateUti = async (e) => {
    e.preventDefault();
    if (!isLogged) return;

    if (!formUti.nombre_apellido.trim() || !formUti.dni.trim()) {
      alert("Nombre y DNI son obligatorios");
      return;
    }

    setSubmitting(true);

    try {
      let newNumber = await getNextHistoryNumber(COUNTER_UTI_PATH);
      newNumber = await ensureNextNumber(newNumber, historiasUti, COUNTER_UTI_PATH);

      const newRef = push(ref(db, HC_UTI_PATH));
      const now = Date.now();

      await set(newRef, {
        nombre: formUti.nombre_apellido.trim(),
        documento: formUti.dni.trim(),
        historia_clinica_1: newNumber,
        alertas: [],
        createdBy: currentUser.user,
        createdByUserKey: currentUser.key,
        createdAt: now,
        modifiedBy: currentUser.user,
        modifiedByUserKey: currentUser.key,
        modifiedAt: now,
      });

      setFormUti({ nombre_apellido: "", dni: "" });
    } catch (error) {
      console.error(error);
      alert("Error al crear historia clínica UTI");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (item) => {
    if (!isLogged) return;

    setEditingId(item.id);
    setEditValues({
      id: item.id,
      source: item.source,
      nombre_apellido: item.nombre_apellido || "",
      dni: item.dni || "",
      historia_clinica: item.historia_clinica || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveEdit = async () => {
    if (!isLogged || !editingId) return;

    try {
      const now = Date.now();

      if (editValues.source === HC_UTI_PATH) {
        await update(ref(db, `${HC_UTI_PATH}/${editingId}`), {
          nombre: editValues.nombre_apellido.trim(),
          documento: editValues.dni.trim(),
          historia_clinica_1: editValues.historia_clinica.trim(),
          modifiedBy: currentUser.user,
          modifiedByUserKey: currentUser.key,
          modifiedAt: now,
        });
      } else {
        await update(ref(db, `${HC_PATH}/${editingId}`), {
          nombre_apellido: editValues.nombre_apellido.trim(),
          dni: editValues.dni.trim(),
          historia_clinica: editValues.historia_clinica.trim(),
          modifiedBy: currentUser.user,
          modifiedByUserKey: currentUser.key,
          modifiedAt: now,
        });
      }

      cancelEdit();
    } catch (error) {
      console.error(error);
      alert("Error al guardar");
    }
  };

  const handleLoadMore = () => {
    if (tab === "general") setVisibleGeneral((prev) => prev + ITEMS_PER_PAGE);
    else setVisibleUti((prev) => prev + ITEMS_PER_PAGE);
  };

  const handleTabChange = (newTab) => {
    setTab(newTab);
    setSearchTerm("");
    setShowOnlyAlerts(false);
    setEditingId(null);
    setEditValues({});
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <p className={styles.metaText}>Cargando historias clínicas...</p>
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className={styles.container}>
        <h1 className={styles.title}>Historias Clínicas</h1>

        <div className={styles.authCard}>
          {isLogged ? (
            <div className={styles.userLoggedBox}>
              <span className={styles.userName}>
                👤 {currentUser.user} ({currentUser.key})
              </span>

              <button
                type="button"
                onClick={handleLogout}
                className={styles.logoutButton}
              >
                Cerrar sesión
              </button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className={styles.loginForm}>
              <input
                type="text"
                placeholder="Usuario"
                value={loginForm.user}
                onChange={(e) =>
                  setLoginForm((prev) => ({
                    ...prev,
                    user: e.target.value,
                  }))
                }
                className={styles.formInput}
              />

              <input
                type="password"
                placeholder="Contraseña"
                value={loginForm.pass}
                onChange={(e) =>
                  setLoginForm((prev) => ({
                    ...prev,
                    pass: e.target.value,
                  }))
                }
                className={styles.formInput}
              />

              <button type="submit" className={styles.loginButton}>
                Iniciar sesión
              </button>
            </form>
          )}
        </div>

        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tabButton} ${tab === "general" ? styles.activeTab : ""}`}
            onClick={() => handleTabChange("general")}
          >
            Historias clínicas
          </button>

          <button
            type="button"
            className={`${styles.tabButton} ${tab === "uti" ? styles.activeTab : ""}`}
            onClick={() => handleTabChange("uti")}
          >
            Historias clínicas UTI
          </button>
        </div>



        {isLogged && tab === "general" && (
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>Nueva historia clínica</h2>

            <form onSubmit={handleCreateGeneral} className={styles.formGrid}>
              <input
                type="text"
                placeholder="Nombre y apellido"
                value={formGeneral.nombre_apellido}
                onChange={(e) =>
                  setFormGeneral((prev) => ({
                    ...prev,
                    nombre_apellido: e.target.value,
                  }))
                }
                className={styles.formInput}
                disabled={submitting}
                required
              />

              <input
                type="text"
                placeholder="DNI"
                value={formGeneral.dni}
                onChange={(e) =>
                  setFormGeneral((prev) => ({
                    ...prev,
                    dni: e.target.value.replace(/\D/g, ""),
                  }))
                }
                className={`${styles.formInput} ${styles.centerInput}`}
                inputMode="numeric"
                disabled={submitting}
                required
              />

              <input
                type="text"
                value={nextGeneralNumber}
                readOnly
                className={`${styles.formInput} ${styles.centerInput} ${styles.hcInput}`}
                aria-label="Próximo número de historia clínica"
              />

              <button
                type="submit"
                className={styles.submitButton}
                disabled={submitting}
              >
                {submitting ? "Guardando..." : `Agregar HC ${nextGeneralNumber}`}
              </button>
            </form>
          </div>
        )}

        {isLogged && tab === "uti" && (
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>Nueva historia clínica UTI</h2>

            <form onSubmit={handleCreateUti} className={styles.formGrid}>
              <input
                type="text"
                placeholder="Nombre y apellido"
                value={formUti.nombre_apellido}
                onChange={(e) =>
                  setFormUti((prev) => ({
                    ...prev,
                    nombre_apellido: e.target.value,
                  }))
                }
                className={styles.formInput}
                disabled={submitting}
                required
              />

              <input
                type="text"
                placeholder="DNI"
                value={formUti.dni}
                onChange={(e) =>
                  setFormUti((prev) => ({
                    ...prev,
                    dni: e.target.value.replace(/\D/g, ""),
                  }))
                }
                className={`${styles.formInput} ${styles.centerInput}`}
                inputMode="numeric"
                disabled={submitting}
                required
              />

              <input
                type="text"
                value={nextUtiNumber}
                readOnly
                className={`${styles.formInput} ${styles.centerInput} ${styles.hcInput}`}
                aria-label="Próximo número de historia clínica UTI"
              />

              <button
                type="submit"
                className={styles.submitButton}
                disabled={submitting}
              >
                {submitting ? "Guardando..." : `Agregar HC UTI ${nextUtiNumber}`}
              </button>
            </form>
          </div>
        )}

        <div className={styles.searchOptions}>
          <select
            value={searchField}
            onChange={(e) => setSearchField(e.target.value)}
            className={styles.searchSelect}
          >
            <option value="all">Buscar en todos los campos</option>
            <option value="nombre">Por nombre y apellido</option>
            <option value="dni">Por DNI</option>
            <option value="historia">Por N° de historia clínica</option>
          </select>

          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={showOnlyAlerts}
              onChange={(e) => setShowOnlyAlerts(e.target.checked)}
              className={styles.checkboxInput}
            />
            Mostrar solo pacientes con alertas
          </label>
        </div>

        <input
          type="text"
          placeholder={`Buscar en ${tab === "general" ? "historias clínicas" : "historias clínicas UTI"}`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />

        <div className={styles.tableWrapper}>
          <div className={styles.tableInner}>
            <table className={styles.responsiveTable}>
              <thead>
                <tr className={styles.tableHeadRow}>
                  <th className={styles.tableHeader}>Nombre y apellido</th>
                  <th className={`${styles.tableHeader} ${styles.centerCell}`}>DNI</th>
                  <th className={`${styles.tableHeader} ${styles.centerCell}`}>N° Historia Clínica</th>
                  <th className={styles.tableHeader}>Alertas</th>
                  <th className={styles.tableHeader}>Creado por</th>
                  <th className={styles.tableHeader}>Modificado por</th>
                </tr>
              </thead>

              <tbody>
                {displayedItems.length === 0 ? (
                  <tr className={styles.tableRow}>
                    <td colSpan="6" className={styles.emptyMessage}>
                      No se encontraron resultados
                    </td>
                  </tr>
                ) : (
                  displayedItems.map((item) => (
                    <tr
                      key={`${item.source}-${item.id}`}
                      className={`${styles.tableRow} ${isLogged ? styles.clickableRow : ""}`}
                      onClick={() => isLogged && startEdit(item)}
                    >
                      {editingId === item.id ? (
                        <>
                          <td className={styles.tableCell}>
                            <input
                              type="text"
                              name="nombre_apellido"
                              value={editValues.nombre_apellido}
                              onChange={(e) =>
                                setEditValues((prev) => ({
                                  ...prev,
                                  nombre_apellido: e.target.value,
                                }))
                              }
                              className={styles.editInput}
                            />
                          </td>

                          <td className={`${styles.tableCell} ${styles.centerCell}`}>
                            <input
                              type="text"
                              name="dni"
                              value={editValues.dni}
                              onChange={(e) =>
                                setEditValues((prev) => ({
                                  ...prev,
                                  dni: e.target.value.replace(/\D/g, ""),
                                }))
                              }
                              className={`${styles.editInput} ${styles.centerInput}`}
                            />
                          </td>

                          <td className={`${styles.tableCell} ${styles.centerCell}`}>
                            <input
                              type="text"
                              name="historia_clinica"
                              value={editValues.historia_clinica}
                              onChange={(e) =>
                                setEditValues((prev) => ({
                                  ...prev,
                                  historia_clinica: e.target.value.replace(/\D/g, ""),
                                }))
                              }
                              className={`${styles.editInput} ${styles.centerInput} ${styles.hcInput}`}
                            />
                          </td>

                          <td className={styles.tableCell}>
                            {item.alertas?.length ? (
                              <span className={styles.alertBadge}>{item.alertas.join(", ")}</span>
                            ) : (
                              <span className={styles.cellMuted}>-</span>
                            )}
                          </td>

                          <td className={styles.tableCell}>{item.createdBy || "-"}</td>

                          <td className={styles.tableCell}>
                            <div className={styles.editButtons}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  saveEdit();
                                }}
                                className={styles.saveButton}
                              >
                                💾
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelEdit();
                                }}
                                className={styles.cancelButton}
                              >
                                ✖
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className={styles.tableCell}>{item.nombre_apellido || "-"}</td>

                          <td className={`${styles.tableCell} ${styles.centerCell} ${styles.dniCell}`}>
                            {formatDni(item.dni)}
                          </td>

                          <td className={`${styles.tableCell} ${styles.centerCell}`}>
                            <span className={styles.hcNumber}>{formatHC(item.historia_clinica)}</span>
                          </td>

                          <td className={styles.tableCell}>
                            {item.alertas?.length ? (
                              <span className={styles.alertBadge}>{item.alertas.join(", ")}</span>
                            ) : (
                              <span className={styles.cellMuted}>-</span>
                            )}
                          </td>

                          <td className={styles.tableCell}>{item.createdBy || "-"}</td>
                          <td className={styles.tableCell}>{item.modifiedBy || "-"}</td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {filteredItems.length > visibleCount && (
          <button
            type="button"
            onClick={handleLoadMore}
            className={styles.loadMoreButton}
          >
            Cargar más ({filteredItems.length - visibleCount} restantes)
          </button>
        )}
      </div>
    </>
  );
}