'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/utils/session';

export default function withAuth(Component, allowedRoles = []) {
    return function ProtectedPage(props) {
        const router = useRouter();
        const [authorized, setAuthorized] = useState(false);

        useEffect(() => {
            // ✅ Solo se ejecuta en cliente
            const session = getSession();
            if (!session) {
                router.push('/login');
                return;
            }

            if (
                allowedRoles.length > 0 &&
                !allowedRoles.includes(session.TipoEmpleado)
            ) {
                router.push('/login');
                return;
            }

            setAuthorized(true);
        }, [router]);

        if (!authorized) {
            return (
                <div className="d-flex justify-content-center align-items-center vh-100">
                    <div className="spinner-border text-success" role="status">
                        <span className="visually-hidden">Cargando...</span>
                    </div>
                </div>
            );
        }

        return <Component {...props} />;
    };
}
