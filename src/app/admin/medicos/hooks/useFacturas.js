import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';

export default function useFacturas() {
    const [facturas, setFacturas] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const factRef = ref(db, 'Facturacion');
        const unsub = onValue(
            factRef,
            (snap) => {
                setFacturas(snap.exists() ? snap.val() : {});
                setLoading(false);
            },
            (error) => {
                console.error('Error al cargar facturación:', error);
                setFacturas({});
                setLoading(false);
            }
        );
        return () => unsub();
    }, []);

    return { facturas, loading };
} 