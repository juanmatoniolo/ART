"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { ref, get } from "firebase/database";
import { useSession } from "@/context/SessionContext";
import Link from "next/link";
import styles from "./login.module.css";
import { LogIn } from "lucide-react";
import Header from "@/components/Header/Header";

export default function LoginPage() {
    const [user, setUser] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { login } = useSession();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading) return;

        setError("");
        setLoading(true);

        const inputUser = user.trim().toLowerCase();
        const inputPass = password.trim();

        try {
            const snapshot = await get(ref(db, "users"));
            const users = snapshot.val();

            if (!users) {
                setError("No se encontraron usuarios en la base de datos.");
                return;
            }

            const found = Object.entries(users).find(
                ([, u]) =>
                    u.user.trim().toLowerCase() === inputUser &&
                    u.password.trim() === inputPass
            );

            if (!found) {
                setError("Usuario o contraseña incorrectos");
                return;
            }

            const [id, userData] = found;

            login({ ...userData, id });

            const esRoot = userData.root === true || userData.TipoEmpleado === "ROOT";
            const routes = {
                ADM: "/admin",
                ADMINISTRADOR: "/administrador",
                "ADM Farmacia": "/farmacia",
                Farmacia: "/farmacia",
                RECEPCION: "/historia-clinica",
                MDE: "/mesa-de-entrada",
                UTI: "/uti/admin",
                MEDICO: "/foja/medicos",
                ROOT: "/admin",
                OS: "/os",
            };

            const destino = esRoot
                ? "/admin"
                : routes[userData.TipoEmpleado] || "/admin";

            router.push(destino);
        } catch (err) {
            console.error("Error en login:", err);
            setError("Error al conectarse al servidor");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.wrapper}>
            <Header />

            <main className={styles.main}>
                <section className={styles.card} aria-labelledby="login-title">
                    <h1 id="login-title" className={styles.title}>
                        Iniciar sesión
                    </h1>
                    <p className={styles.subtitle}>
                        Accedé para gestionar pacientes y registros clínicos.
                    </p>

                    <form onSubmit={handleSubmit} className={styles.form} noValidate>
                        <div className={styles.field}>
                            <label htmlFor="login-user" className={styles.label}>
                                Usuario
                            </label>
                            <input
                                id="login-user"
                                type="text"
                                className={styles.input}
                                value={user}
                                onChange={(e) => setUser(e.target.value)}
                                placeholder="Ingresá tu usuario"
                                autoComplete="username"
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck={false}
                                required
                            />
                        </div>

                        <div className={styles.field}>
                            <label htmlFor="login-pass" className={styles.label}>
                                Contraseña
                            </label>
                            <input
                                id="login-pass"
                                type="password"
                                className={styles.input}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Ingresá tu contraseña"
                                autoComplete="current-password"
                                required
                            />
                        </div>

                        {error && (
                            <div
                                className={`${styles.alert} ${styles.alertDanger}`}
                                role="alert"
                            >
                                <span className={styles.alertIcon} aria-hidden="true">
                                    ⚠️
                                </span>
                                <span>{error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            disabled={loading}
                        >
                            <LogIn size={18} aria-hidden="true" />
                            {loading ? "Ingresando…" : "Ingresar"}
                        </button>
                    </form>

                    <div className={styles.registerHint}>
                        <small className={styles.muted}>
                            ¿No tenés cuenta?{" "}
                            <Link className={styles.link} href="/register">
                                Registrate aquí
                            </Link>
                        </small>
                    </div>
                </section>
            </main>

            <footer className={styles.footer}>
                © {new Date().getFullYear()} Clínica de la Unión S.A.
            </footer>
        </div>
    );
}