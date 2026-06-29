"use client";

import { useEffect, useMemo, useState } from "react";
import { ref, onValue, set, update, remove, runTransaction } from "firebase/database";
import { db } from "@/lib/firebase";
import { getSession } from "@/utils/session";
import styles from "./empleados.module.css";

const USERS_PATH = "users";
const USERS_COUNTER_PATH = "counters/users/lastIndex";

const EMPTY_FORM = {
  nombre: "",
  user: "",
  password: "",
  TipoEmpleado: "ADM",
};

const ROLES = ["ADM", "ADMIN", "RECEPCION", "ENFERMERIA", "UTI", "FARM", "MEDICO"];

const normalizeText = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const normalizeUser = (value = "") => normalizeText(value).toLowerCase();

const getPasswordValue = (value = {}) =>
  String(value.password || value.pass || "").trim();

const getRoleValue = (value = {}) =>
  String(value.TipoEmpleado || value.tipoEmpleado || value.rol || "").trim();

const isAdminRole = (role = "") => {
  const normalized = normalizeUser(role);
  return ["adm", "admin", "administracion", "administrador"].includes(normalized);
};

export default function Page() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [session, setSession] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingKey, setEditingKey] = useState(null);
  const [search, setSearch] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);

  useEffect(() => {
    const currentSession = getSession();
    setSession(currentSession || null);

    const usersRef = ref(db, USERS_PATH);

    const unsub = onValue(usersRef, (snapshot) => {
      const data = snapshot.val() || {};

      const parsed = Object.entries(data)
        .filter(([key, value]) => key.startsWith("usuario") && value && typeof value === "object")
        .map(([key, value]) => ({
          key,
          nombre: String(value.nombre || "").trim(),
          user: String(value.user || value.usuario || "").trim(),
          password: getPasswordValue(value),
          TipoEmpleado: getRoleValue(value),
          raw: value,
        }))
        .sort((a, b) => {
          const aNum = Number(String(a.key).replace("usuario", "")) || 0;
          const bNum = Number(String(b.key).replace("usuario", "")) || 0;
          return aNum - bNum;
        });

      setUsers(parsed);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const currentUser = useMemo(() => {
    if (!session || !users.length) return null;

    const sessionUser = String(session.user || session.usuario || "").trim();
    const sessionPassword = String(session.password || session.pass || "").trim();

    return (
      users.find(
        (item) =>
          normalizeUser(item.user) === normalizeUser(sessionUser) &&
          item.password === sessionPassword
      ) || null
    );
  }, [session, users]);

  const isAdmin = useMemo(() => {
    const role = currentUser?.TipoEmpleado || session?.TipoEmpleado || "";
    return isAdminRole(role);
  }, [currentUser, session]);

  const filteredUsers = useMemo(() => {
    const term = normalizeUser(search);
    if (!term) return users;

    return users.filter((item) => {
      return (
        normalizeUser(item.nombre).includes(term) ||
        normalizeUser(item.user).includes(term) ||
        normalizeUser(item.TipoEmpleado).includes(term) ||
        normalizeUser(item.key).includes(term)
      );
    });
  }, [users, search]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingKey(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: name === "user" ? value.replace(/\s+/g, "").toLowerCase() : value,
    }));
  };

  const getNextUserKey = async () => {
    const counterRef = ref(db, USERS_COUNTER_PATH);

    const tx = await runTransaction(counterRef, (currentValue) => {
      const currentNumber = Number(currentValue || 0);
      return currentNumber + 1;
    });

    if (!tx.committed) {
      throw new Error("No se pudo generar el identificador");
    }

    return `usuario${tx.snapshot.val()}`;
  };

  const ensureCounterSync = async () => {
    const maxUserNumber = users.reduce((acc, item) => {
      const num = Number(String(item.key).replace("usuario", "")) || 0;
      return Math.max(acc, num);
    }, 0);

    const counterRef = ref(db, USERS_COUNTER_PATH);

    await runTransaction(counterRef, (currentValue) => {
      const current = Number(currentValue || 0);
      return current < maxUserNumber ? maxUserNumber : current;
    });
  };

  const validateForm = () => {
    if (!form.nombre.trim()) {
      alert("El nombre es obligatorio");
      return false;
    }

    if (!form.user.trim()) {
      alert("El usuario es obligatorio");
      return false;
    }

    if (!form.password.trim()) {
      alert("La contraseña es obligatoria");
      return false;
    }

    if (!form.TipoEmpleado.trim()) {
      alert("Debes asignar un rol");
      return false;
    }

    const duplicatedUser = users.find(
      (item) =>
        normalizeUser(item.user) === normalizeUser(form.user) &&
        item.key !== editingKey
    );

    if (duplicatedUser) {
      alert("Ese nombre de usuario ya existe");
      return false;
    }

    return true;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);

    try {
      await ensureCounterSync();
      const newKey = await getNextUserKey();

      await set(ref(db, `${USERS_PATH}/${newKey}`), {
        nombre: form.nombre.trim(),
        user: form.user.trim(),
        password: form.password.trim(),
        TipoEmpleado: form.TipoEmpleado.trim(),
        createdAt: Date.now(),
        createdBy: currentUser?.user || session?.user || "admin",
      });

      resetForm();
    } catch (error) {
      console.error(error);
      alert("No se pudo crear el usuario");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item) => {
    setEditingKey(item.key);
    setForm({
      nombre: item.nombre || "",
      user: item.user || "",
      password: item.password || "",
      TipoEmpleado: item.TipoEmpleado || "ADM",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingKey) return;
    if (!validateForm()) return;

    setSaving(true);

    try {
      await update(ref(db, `${USERS_PATH}/${editingKey}`), {
        nombre: form.nombre.trim(),
        user: form.user.trim(),
        password: form.password.trim(),
        TipoEmpleado: form.TipoEmpleado.trim(),
        updatedAt: Date.now(),
        updatedBy: currentUser?.user || session?.user || "admin",
      });

      resetForm();
    } catch (error) {
      console.error(error);
      alert("No se pudo actualizar el usuario");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (key, username) => {
    const confirmed = window.confirm(`¿Seguro que querés eliminar el usuario "${username}"?`);
    if (!confirmed) return;

    try {
      await remove(ref(db, `${USERS_PATH}/${key}`));

      if (editingKey === key) {
        resetForm();
      }
    } catch (error) {
      console.error(error);
      alert("No se pudo eliminar el usuario");
    }
  };

  const getMaskedPassword = (password = "") => {
    if (!password) return "-";
    return "•".repeat(Math.max(password.length, 6));
  };

  if (loading) {
    return <div className={styles.container}>Cargando usuarios...</div>;
  }

  if (!session) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          Debes iniciar sesión para administrar usuarios.
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          No tenés permisos para acceder al CRUD de empleados.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>

      <div className={styles.grid}>
        <section className={styles.formCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>
              {editingKey ? "Editar usuario" : "Nuevo usuario"}
            </h2>

            {editingKey && (
              <button
                type="button"
                onClick={resetForm}
                className={styles.secondaryButton}
              >
                Cancelar edición
              </button>
            )}
          </div>

          <form onSubmit={editingKey ? handleUpdate : handleCreate} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Nombre</label>
              <input
                type="text"
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                className={styles.input}
                placeholder="Ej: Silvina Gómez"
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Usuario</label>
              <input
                type="text"
                name="user"
                value={form.user}
                onChange={handleChange}
                className={styles.input}
                placeholder="Ej: farmacia"
                autoComplete="off"
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Contraseña</label>
              <input
                type="text"
                name="password"
                value={form.password}
                onChange={handleChange}
                className={styles.input}
                placeholder="Ej: farmacia39"
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Rol / TipoEmpleado</label>
              <select
                name="TipoEmpleado"
                value={form.TipoEmpleado}
                onChange={handleChange}
                className={styles.select}
                required
              >
                {ROLES.map((rol) => (
                  <option key={rol} value={rol}>
                    {rol}
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" disabled={saving} className={styles.primaryButton}>
              {saving ? "Guardando..." : editingKey ? "Actualizar usuario" : "Crear usuario"}
            </button>
          </form>
        </section>

        <section className={styles.tableCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Usuarios</h2>
            <span className={styles.counter}>{filteredUsers.length}</span>
          </div>

          <div className={styles.searchBox}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.input}
              placeholder="Buscar por nombre, usuario, clave o rol"
            />
          </div>

          {filteredUsers.length === 0 ? (
            <div className={styles.emptyState}>No hay usuarios para mostrar</div>
          ) : (
            <>
              <div className={styles.mobileCards}>
                {filteredUsers.map((item) => (
                  <article key={item.key} className={styles.userCard}>
                    <div className={styles.userCardTop}>
                      <div>
                        <h3 className={styles.userCardTitle}>{item.nombre || "-"}</h3>
                        <p className={styles.userCardKey}>{item.key}</p>
                      </div>

                      <span className={styles.roleBadge}>{item.TipoEmpleado || "-"}</span>
                    </div>

                    <div className={styles.userCardBody}>
                      <div className={styles.userCardRow}>
                        <span className={styles.userCardLabel}>Usuario</span>
                        <span className={styles.userCardValue}>{item.user || "-"}</span>
                      </div>

                      <div className={styles.userCardRow}>
                        <span className={styles.userCardLabel}>Contraseña</span>
                        <span className={styles.userCardValue}>
                          {showPasswords ? item.password || "-" : getMaskedPassword(item.password)}
                        </span>
                      </div>

                      <div className={styles.userCardRow}>
                        <span className={styles.userCardLabel}>Rol</span>
                        <span className={styles.userCardValue}>{item.TipoEmpleado || "-"}</span>
                      </div>
                    </div>

                    <div className={styles.userCardActions}>
                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        className={styles.editButton}
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(item.key, item.user)}
                        className={styles.deleteButton}
                      >
                        Eliminar
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                    
                      <th>Nombre</th>
                      <th>Usuario</th>
                      <th>Contraseña</th>
                      <th>Rol</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>

                  <tbody className="w-90">
                    {filteredUsers.map((item) => (
                      <tr key={item.key}>
                        <td>{item.nombre}</td>
                        <td>{item.user}</td>
                        <td>
                          {showPasswords ? item.password : getMaskedPassword(item.password)}
                        </td>
                        <td>
                          <span className={styles.roleBadge}>{item.TipoEmpleado}</span>
                        </td>
                        <td>
                          <div className={styles.actions}>
                            <button
                              type="button"
                              onClick={() => handleEdit(item)}
                              className={styles.editButton}
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(item.key, item.user)}
                              className={styles.deleteButton}
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}