"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, LayoutGrid, Mail, ArrowLeft } from "lucide-react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useSession } from "@/context/SessionContext";
import { AREAS, canUse, panelsFor, isInternalEmail } from "@/lib/roles";
import Header from "@/components/Header/Header";
import PasswordInput from "@/components/PasswordInput/PasswordInput";
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

/**
 * Mensaje para mostrar ante un error de login. Si es un error conocido usa el
 * texto amigable; si no, agrega el código de Firebase para poder diagnosticar
 * (ej. clave de API sin permiso para Authentication).
 */
function authErrorMessage(err) {
    const code = String(err?.code || "");
    if (AUTH_ERRORS[code]) return AUTH_ERRORS[code];
    if (/api-key|requests-from-referer|permission|internal-error/i.test(code)) {
        return `El servicio de inicio de sesión no está bien configurado. Avisale al administrador. (código: ${code})`;
    }
    const detalle = code || String(err?.message || "").slice(0, 120) || "desconocido";
    return `No se pudo iniciar sesión. Intentá de nuevo. (código: ${detalle})`;
}

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
    const [recuperando, setRecuperando] = useState(false);
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
            setError(authErrorMessage(err));
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

    if (recuperando) {
        return (
            <RecuperarForm
                inicial={identifier.includes("@") ? identifier.trim() : ""}
                onVolver={() => setRecuperando(false)}
            />
        );
    }

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
                    <PasswordInput
                        id="login-pass"
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

                <button type="button" className={styles.linkBtn} onClick={() => setRecuperando(true)}>
                    ¿Olvidaste tu contraseña?
                </button>
            </form>

            <div className={styles.registerHint}>
                <small className={styles.muted}>¿No tenés usuario? Pedíselo al administrador.</small>
            </div>
        </section>
    );
}

const RESET_ERRORS = {
    "auth/invalid-email": "El correo no es válido.",
    "auth/missing-email": "Ingresá tu correo.",
    "auth/too-many-requests": "Demasiados intentos. Esperá unos minutos y volvé a probar.",
    "auth/network-request-failed": "No hay conexión con el servidor. Revisá tu internet.",
};

/**
 * Recuperar contraseña: Firebase envía un correo con un enlace para crear una
 * contraseña nueva. Solo sirve para cuentas con correo real: las que entran con
 * nombre de usuario tienen un correo interno que no recibe mails.
 * Por seguridad el mensaje de éxito es el mismo exista o no la cuenta.
 */
function RecuperarForm({ inicial = "", onVolver }) {
    const [email, setEmail] = useState(inicial);
    const [error, setError] = useState("");
    const [enviado, setEnviado] = useState(false);
    const [enviando, setEnviando] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (enviando) return;
        setError("");
        const v = email.trim().toLowerCase();
        if (!v) return setError("Ingresá el correo de tu cuenta.");
        if (!v.includes("@") || isInternalEmail(v)) {
            return setError(
                "Si entrás con nombre de usuario, tu cuenta no tiene un correo para recuperar la contraseña. Pedile al administrador que te la cambie o que asocie tu email a la cuenta."
            );
        }
        setEnviando(true);
        try {
            auth.languageCode = "es";
            try {
                // Al terminar, el enlace ofrece volver al login de la app
                await sendPasswordResetEmail(auth, v, { url: `${window.location.origin}/login` });
            } catch (err) {
                // Dominio no autorizado en Firebase para la vuelta: se envía igual, sin botón de volver
                if (!String(err?.code || "").includes("continue-uri")) throw err;
                await sendPasswordResetEmail(auth, v);
            }
            setEnviado(true);
        } catch (err) {
            const code = String(err?.code || "");
            if (code === "auth/user-not-found") setEnviado(true); // no revelar si la cuenta existe
            else setError(RESET_ERRORS[code] || `No se pudo enviar el correo. (código: ${code || "desconocido"})`);
        } finally {
            setEnviando(false);
        }
    };

    return (
        <section className={styles.card} aria-labelledby="reset-title">
            <h1 id="reset-title" className={styles.title}>
                Recuperar contraseña
            </h1>
            <p className={styles.subtitle}>
                Te enviamos un correo con un enlace para crear una contraseña nueva.
            </p>

            {enviado ? (
                <div className={styles.form}>
                    <div className={`${styles.alert} ${styles.alertSuccess}`} role="status">
                        <span>
                            Si <b>{email.trim()}</b> corresponde a una cuenta, en unos minutos te llega el correo.
                            Revisá también la carpeta de spam o correo no deseado.
                        </span>
                    </div>
                    <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onVolver}>
                        <ArrowLeft size={18} aria-hidden="true" />
                        Volver a iniciar sesión
                    </button>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className={styles.form} noValidate>
                    <div className={styles.field}>
                        <label htmlFor="reset-email" className={styles.label}>
                            Correo de tu cuenta
                        </label>
                        <input
                            id="reset-email"
                            type="email"
                            className={styles.input}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="nombre@ejemplo.com"
                            autoComplete="email"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            required
                            autoFocus
                        />
                    </div>

                    {error && (
                        <div className={`${styles.alert} ${styles.alertDanger}`} role="alert">
                            <span>{error}</span>
                        </div>
                    )}

                    <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={enviando}>
                        <Mail size={18} aria-hidden="true" />
                        {enviando ? "Enviando…" : "Enviar enlace"}
                    </button>

                    <button type="button" className={styles.linkBtn} onClick={onVolver}>
                        Volver a iniciar sesión
                    </button>
                </form>
            )}
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
