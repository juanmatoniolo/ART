'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { setSession } from '@/utils/session';
import Link from 'next/link';
import styles from './login.module.css';
import { Stethoscope, LogIn } from 'lucide-react';

export default function LoginPage() {
    const [user, setUser] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const router = useRouter();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const inputUser = user.trim().toLowerCase();
        const inputPass = password.trim();

        try {
            const snapshot = await get(ref(db, 'users'));
            const users = snapshot.val();

            if (!users) {
                setError('No se encontraron usuarios en la base de datos.');
                return;
            }

            const found = Object.entries(users).find(
                ([, u]) =>
                    u.user.trim().toLowerCase() === inputUser &&
                    u.password.trim() === inputPass
            );

            if (!found) {
                setError('Usuario o contraseña incorrectos');
                return;
            }

            const [id, userData] = found;
            setSession({ ...userData, id });

            const routes = {
                ADM: '/admin',
                DR: '/doctores',
                MDE: '/mesa-de-entrada',
            };

            router.push(routes[userData.TipoEmpleado] || '/admin');
        } catch (err) {
            console.error('Error en login:', err);
            setError('Error al conectarse al servidor');
        }
    };

    return (
        <div className={styles.wrapper}>
            {/* NAVBAR minimalista (igual que Home) */}
            <header className={styles.header}>
                <Link href="/" className={styles.brand} aria-label="Inicio">
                    <Stethoscope size={20} aria-hidden="true" />
                    <span>Clínica de la Unión S.A.</span>
                </Link>
            </header>

            {/* Contenido */}
            <main className={styles.main}>
                <section className={styles.card} aria-labelledby="login-title">
                    <h1 id="login-title" className={styles.title}>Iniciar sesión</h1>
                    <p className={styles.subtitle}>
                        Acceda para gestionar pacientes y registros clínicos.
                    </p>

                    <form onSubmit={handleSubmit} className={styles.form}>
                        <div className="mb-3">
                            <label className="form-label">Usuario</label>
                            <input
                                type="text"
                                className="form-control"
                                value={user}
                                onChange={(e) => setUser(e.target.value)}
                                placeholder="Ingrese su usuario"
                                required
                            />
                        </div>

                        <div className="mb-3">
                            <label className="form-label">Contraseña</label>
                            <input
                                type="password"
                                className="form-control"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Ingrese su contraseña"
                                required
                            />
                        </div>

                        {error && <div className="alert alert-danger">{error}</div>}

                        <button type="submit" className={`${styles.btn} ${styles.btnPrimary} w-100`}>
                            <LogIn size={18} aria-hidden="true" />
                            Ingresar
                        </button>
                    </form>

                    <div className={styles.registerHint}>
                        <small className={styles.muted}>
                            ¿No tienes cuenta? <Link className={styles.link} href="/register">Regístrate aquí</Link>
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
