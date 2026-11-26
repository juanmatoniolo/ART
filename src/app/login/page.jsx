"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, LayoutGrid } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { AREAS, canUse, panelsFor } from "@/lib/roles";
import Header from "@/components/Header/Header";
import styles from "./login.module.css";

const AUTH_ERRORS = {
    "auth/invalid-credential": "Usuario o contraseña incorrectos.",
    "auth/wrong-password": "Usuario o contraseña incorrectos.",
    "auth/user-not-found": "Usuario o contraseña incorrectos.",
    "auth/invalid-email": "El email o usuario no es válido.",
    "auth/user-disabled": "Tu usuario tiene el servicio cortado. Hablá con el administrador.",
    "auth/too-many-requests": "Demasiados intentos. Esperá unos minutos y volvé a probar.",
    "auth/network-request-failed": "No hay conexión con el servidor. Revisá tu internet.",
    "auth/operation-not-allowed": "El ingreso con email no está habilitado en Firebase. Avisale al administrador.",
};

const STATUS_ERRORS = {
    suspended: "Tu usuario tiene el servicio cortado. Hablá con el administrador.",
    noprofile: "Tu cuenta todavía no tiene roles asignados. Hablá con el administrador.",
};

/** ¿El destino pedido (?next=) está permitido para estos roles? */
function allowedNext(next, roles) {
    if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
    const area = Object.keys(AREAS).find((a) => next === a || next.startsWith(a + "/"));
    return area && canUse(roles, AREAS[area]) ? next : null;
}

function LoginForm() {
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const router = useRouter();
    const params = useSearchParams();
    const { login, status, usuario } = useSession();

    // Destino una vez activa la sesión
    const roles = status === "active" ? usuario?.roles || [] : null;
    const next = roles ? allowedNext(params.get("next"), roles) : null;
    const options = roles ? panelsFor(roles) : [];
    const autoTarget = next || (options.length === 1 ? options[0].href : null);
    const panels = roles && !autoTarget && options.length > 1 ? options : null;
    const statusError =
        STATUS_ERRORS[status] || (roles && options.length === 0 ? STATUS_ERRORS.noprofile : "");

    useEffect(() => {
        if (autoTarget) router.replace(autoTarget);
    }, [autoTarget, router]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submitting) return;
        setError("");
        if (!identifier.trim() || !password) {
            setError("Completá usuario y contraseña.");
            return;
        }
        setSubmitting(true);
        try {
            await login(identifier, password);
            // La redirección la hace el efecto cuando llega el perfil
        } catch (err) {
            setError(AUTH_ERRORS[err?.code] || "No se pudo iniciar sesión. Intentá de nuevo.");
            setSubmitting(false);
        }
    };

    if (panels) {
        return (
            <section className={styles.card} aria-labelledby="panel-title">
                <h1 id="panel-title" className={styles.title}>
                    Elegí un panel
                </h1>
                <p className={styles.subtitle}>Tu usuario tiene acceso a varias secciones.</p>
                <div className={styles.form}>
                    {panels.map((p) => (
                        <button
                            key={p.href}
                            type="button"
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            onClick={() => router.replace(p.href)}
                        >
                            <LayoutGrid size={18} aria-hidden="true" />
                            {p.label}
                        </button>
                    ))}
                </div>
            </section>
        );
    }

    const busy = submitting && !statusError && !error;
    const shownError = error || statusError;

    return (
        <section className={styles.card} aria-labelledby="login-title">
            <h1 id="login-title" className={styles.title}>
                Iniciar sesión
            </h1>
            <p className={styles.subtitle}>Accedé para gestionar pacientes y registros clínicos.</p>

            <form onSubmit={handleSubmit} className={styles.form} noValidate>
                <div className={styles.field}>
                    <label htmlFor="login-user" className={styles.label}>
                        Email o usuario
                    </label>
                    <input
                        id="login-user"
                        type="text"
                        inputMode="email"
                        className={styles.input}
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="nombre@ejemplo.com"
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

                {shownError && (
                    <div className={`${styles.alert} ${styles.alertDanger}`} role="alert">
                        <span>{shownError}</span>
                    </div>
                )}

                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy}>
                    <LogIn size={18} aria-hidden="true" />
                    {busy ? "Ingresando…" : "Ingresar"}
                </button>
            </form>

            <div className={styles.registerHint}>
                <small className={styles.muted}>
                    ¿No tenés usuario u olvidaste tu contraseña? Pedíselo al administrador.
                </small>
            </div>
        </section>
    );
}

export default function LoginPage() {
    return (
        <div className={styles.wrapper}>
            <Header />
            <main className={styles.main}>
                <Suspense fallback={null}>
                    <LoginForm />
                </Suspense>
            </main>
            <footer className={styles.footer}>© {new Date().getFullYear()} Clínica de la Unión S.A.</footer>
        </div>
    );
}
