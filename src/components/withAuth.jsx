'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/utils/session';

export default function withAuth(Component, allowedRoles = []) {
    return function ProtectedPage(props) {
        const router = useRouter();
        const [authorized, setAuthorized] = useState(false);

        useEffect(() => {
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
        }, []);

        if (!authorized) return null;

        return <Component {...props} />;
    };
}
