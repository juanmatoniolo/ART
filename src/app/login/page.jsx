'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getSession } from '@/utils/session';

export default function FichaPaciente() {
    const { id } = useParams();
    const [paciente, setPaciente] = useState(null);
    const [evoluciones, setEvoluciones] = useState([]);
    const [pedidos, setPedidos] = useState([]);
    const [nuevaEvolucion, setNuevaEvolucion] = useState('');
    const [mostrarPedido, setMostrarPedido] = useState(false);
    const [practica, setPractica] = useState('');
    const [firmante, setFirmante] = useState('');
    const [tipoEmpleado, setTipoEmpleado] = useState(null);

    useEffect(() => {
        const session = getSession();
        if (session) setTipoEmpleado(session.TipoEmpleado);
    }, []);

    useEffect(() => {
        const obtenerPaciente = async () => {
            const res = await fetch(`https://datos-clini-default-rtdb.firebaseio.com/pacientes/${id}.json`);
            const data = await res.json();
            setPaciente(data);
        };

        const obtenerEvoluciones = async () => {
            const res = await fetch(`https://datos-clini-default-rtdb.firebaseio.com/pacientes/${id}/evolucionesMedicas.json`);
            const data = await res.json();
            if (data) {
                const lista = Object.entries(data).map(([eid, ev]) => ({ id: eid, ...ev }));
                setEvoluciones(lista);
            }
        };

        const obtenerPedidos = async () => {
            const res = await fetch(`https://datos-clini-default-rtdb.firebaseio.com/pacientes/${id}/pedidos.json`);
            const data = await res.json();
            if (data) {
                const lista = Object.entries(data).map(([pid, val]) => ({ id: pid, ...val }));
                setPedidos(lista);
            }
        };

        if (id) {
            obtenerPaciente();
            obtenerEvoluciones();
            obtenerPedidos();
        }
    }, [id]);

    const agregarEvolucion = async (e) => {
        e.preventDefault();
        if (!nuevaEvolucion.trim()) return;

        const session = getSession();
        const nueva = {
            texto: nuevaEvolucion,
            fecha: new Date().toISOString(),
            firmante: session?.user || 'Sin firmante'
        };

        await fetch(`https://datos-clini-default-rtdb.firebaseio.com/pacientes/${id}/evolucionesMedicas.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nueva)
        });

        setEvoluciones(prev => [...prev, nueva]);
        setNuevaEvolucion('');
    };

    const realizarPedido = async () => {
        if (!practica.trim() || !firmante.trim()) return;
        const pedido = {
            practica,
            firmante,
            fecha: new Date().toISOString(),
            estado: 'Pendiente'
        };

        await fetch(`https://datos-clini-default-rtdb.firebaseio.com/pacientes/${id}/pedidos.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pedido)
        });

        setMostrarPedido(false);
        setPractica('');
        setFirmante('');
        setPedidos(prev => [...prev, pedido]);
        alert('Pedido registrado correctamente');
    };

    const cambiarEstadoPedido = async (pedidoId, nuevoEstado) => {
        await fetch(`https://datos-clini-default-rtdb.firebaseio.com/pacientes/${id}/pedidos/${pedidoId}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: nuevoEstado })
        });

        setPedidos(pedidos.map(p => p.id === pedidoId ? { ...p, estado: nuevoEstado } : p));
    };

    const darAltaMedica = async () => {
        if (!confirm('¿Está seguro de dar el alta médica al paciente?')) return;

        const evolucion = {
            texto: 'Alta médica otorgada.',
            fecha: new Date().toISOString(),
            firmante: getSession()?.user || 'Sin firmante'
        };

        await fetch(`https://datos-clini-default-rtdb.firebaseio.com/pacientes/${id}/evolucionesMedicas.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(evolucion)
        });

        await fetch(`https://datos-clini-default-rtdb.firebaseio.com/pacientes/${id}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: 'Alta médica' })
        });

        setEvoluciones(prev => [...prev, evolucion]);
        alert('Paciente dado de alta médica.');
    };

    if (!paciente) return <p className="text-center mt-4">Cargando ficha...</p>;

    return <>{/* TODO: Render completo con tipoEmpleado real */}</>;
}
