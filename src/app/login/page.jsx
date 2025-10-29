// src/app/login/page.jsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { setSession } from '@/utils/session';
import 'bootstrap/dist/css/bootstrap.min.css';

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

            // redirección según tipo
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
        <div
            className="d-flex align-items-center justify-content-center vh-100"
            style={{ backgroundColor: '#f0f4f0' }}
        >
            <div className="card shadow-lg p-4" style={{ width: '100%', maxWidth: '400px' }}>
                <h3 className="text-center mb-4 text-success">
                    Clínica de la Unión S.A.
                </h3>

                <form onSubmit={handleSubmit}>
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

                    <button type="submit" className="btn btn-success w-100">
                        Ingresar
                    </button>
                </form>

                <div className="text-center mt-3">
                    <small className="text-muted">
                        ¿No tienes cuenta? <a href="/register">Regístrate aquí</a>
                    </small>
                </div>
            </div>
        </div>
    );
}
