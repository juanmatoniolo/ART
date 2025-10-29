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
  const [tipoEmpleado, setTipoEmpleado] = useState('');

  useEffect(() => {
    const session = getSession();
    if (session) {
      setTipoEmpleado(session.TipoEmpleado);
      setFirmante(`${session.Nombre} ${session.Apellido}`);
    }
  }, []);

  useEffect(() => {
    if (!id) return;

    const obtenerPaciente = async () => {
      try {
        const res = await fetch(`https://datos-clini-default-rtdb.firebaseio.com/pacientes/${id}.json`);
        const data = await res.json();
        setPaciente(data);
      } catch (error) {
        console.error('Error al cargar el paciente:', error);
      }
    };

    const obtenerEvoluciones = async () => {
      try {
        const res = await fetch(`https://datos-clini-default-rtdb.firebaseio.com/pacientes/${id}/evolucionesMedicas.json`);
        const data = await res.json();
        if (data && typeof data === 'object') {
          const lista = Object.entries(data).map(([eid, ev]) => ({ id: eid, ...ev }));
          setEvoluciones(lista);
        } else setEvoluciones([]);
      } catch (err) {
        console.error('Error al obtener evoluciones:', err);
      }
    };

    const obtenerPedidos = async () => {
      try {
        const res = await fetch(`https://datos-clini-default-rtdb.firebaseio.com/pacientes/${id}/pedidos.json`);
        const data = await res.json();
        if (data && typeof data === 'object') {
          const lista = Object.entries(data).map(([pid, val]) => ({ id: pid, ...val }));
          setPedidos(lista);
        } else setPedidos([]);
      } catch (err) {
        console.error('Error al obtener pedidos:', err);
      }
    };

    obtenerPaciente();
    obtenerEvoluciones();
    obtenerPedidos();
  }, [id]);

  const agregarEvolucion = async (e) => {
    e.preventDefault();
    if (!nuevaEvolucion.trim()) return;

    const nueva = {
      texto: nuevaEvolucion,
      fecha: new Date().toISOString(),
      firmante,
    };

    try {
      await fetch(`https://datos-clini-default-rtdb.firebaseio.com/pacientes/${id}/evolucionesMedicas.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nueva),
      });
      setEvoluciones(prev => [...prev, nueva]);
      setNuevaEvolucion('');
    } catch (err) {
      console.error('Error al guardar evolución:', err);
    }
  };

  const realizarPedido = async () => {
    if (!practica.trim()) return;
    const pedido = {
      practica,
      firmante,
      fecha: new Date().toISOString(),
      estado: 'Pendiente',
    };

    try {
      const res = await fetch(`https://datos-clini-default-rtdb.firebaseio.com/pacientes/${id}/pedidos.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pedido),
      });
      const data = await res.json();
      setPedidos(prev => [...prev, { id: data.name, ...pedido }]);
      setMostrarPedido(false);
      setPractica('');
    } catch (error) {
      console.error('Error al registrar pedido:', error);
    }
  };

  const actualizarEstadoPedido = async (pedidoId, nuevoEstado) => {
    try {
      await fetch(`https://datos-clini-default-rtdb.firebaseio.com/pacientes/${id}/pedidos/${pedidoId}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      setPedidos(prev =>
        prev.map(p => (p.id === pedidoId ? { ...p, estado: nuevoEstado } : p))
      );
    } catch (err) {
      console.error('Error al actualizar estado:', err);
    }
  };

  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'Pendiente':
        return 'bg-warning text-dark';
      case 'Solicitado':
        return 'bg-info text-dark';
      case 'Aprobado':
        return 'bg-success';
      default:
        return 'bg-secondary';
    }
  };

  const darAltaMedica = async () => {
    if (!confirm('¿Está seguro de dar el alta médica al paciente?')) return;

    const evolucion = {
      texto: 'Alta médica otorgada.',
      fecha: new Date().toISOString(),
      firmante,
    };

    try {
      await fetch(`https://datos-clini-default-rtdb.firebaseio.com/pacientes/${id}/evolucionesMedicas.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evolucion),
      });
      await fetch(`https://datos-clini-default-rtdb.firebaseio.com/pacientes/${id}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'Alta médica' }),
      });
      setEvoluciones(prev => [...prev, evolucion]);
      alert('Paciente dado de alta médica.');
    } catch (error) {
      console.error('Error al dar alta médica:', error);
    }
  };

  if (!paciente) return <p className="text-center mt-4">Cargando ficha...</p>;

  return (
    <div className="container py-4">
      <h2 className="mb-4">Ficha de {paciente.Nombre} {paciente.Apellido}</h2>

      <div className="row mb-4">
        <div className="col-md-6">
          <ul className="list-group">
            <li className="list-group-item"><strong>DNI:</strong> {paciente.dni}</li>
            <li className="list-group-item"><strong>Empleador:</strong> {paciente.Empleador}</li>
            <li className="list-group-item"><strong>ART:</strong> {paciente.ART}</li>
            <li className="list-group-item"><strong>Estado:</strong> {paciente.estado || 'En tratamiento'}</li>
          </ul>

          {tipoEmpleado === 'ADM' && (
            <div className="mt-4 d-flex gap-2">
              <button className="btn btn-info" onClick={() => setMostrarPedido(true)}>📦 Realizar pedido</button>
              <button className="btn btn-danger" onClick={darAltaMedica}>🏥 Alta médica</button>
            </div>
          )}
        </div>

        {tipoEmpleado === 'ADM' && (
          <div className="col-md-6">
            <h4>Agregar Evolución Médica</h4>
            <form onSubmit={agregarEvolucion} className="mt-3">
              <textarea
                className="form-control mb-2"
                rows="4"
                placeholder="Describa la evolución médica..."
                value={nuevaEvolucion}
                onChange={(e) => setNuevaEvolucion(e.target.value)}
              ></textarea>
              <button type="submit" className="btn btn-success w-100">Guardar evolución</button>
            </form>
          </div>
        )}
      </div>

      {/* 🩺 Evoluciones */}
      <div className="mt-5">
        <h4 className="mb-3">Evoluciones Médicas</h4>
        {evoluciones.length === 0 ? (
          <p className="text-muted">Sin evoluciones registradas.</p>
        ) : (
          <ul className="list-group">
            {[...evoluciones].reverse().map(ev => (
              <li key={ev.id} className="list-group-item">
                <p className="mb-1">{ev.texto}</p>
                <small className="text-muted">
                  {new Date(ev.fecha).toLocaleString()} — {ev.firmante || 'Sin firma'}
                </small>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 🧾 Pedidos Médicos */}
      <div className="mt-5">
        <h4 className="mb-3">Pedidos Médicos</h4>
        {pedidos.length === 0 ? (
          <p className="text-muted">Sin pedidos registrados.</p>
        ) : (
          <ul className="list-group">
            {[...pedidos].reverse().map(p => (
              <li key={p.id} className="list-group-item d-flex justify-content-between align-items-center">
                <div>
                  <strong>{p.practica}</strong><br />
                  <small className="text-muted">
                    Solicitado por: {p.firmante} el {new Date(p.fecha).toLocaleString()}
                  </small>
                </div>
                <div className="text-end">
                  <span className={`badge ${getEstadoColor(p.estado)} p-2`}>{p.estado}</span>

                  {/* 🔽 Tooltip/Dropdown solo visible para ADM */}
                  {tipoEmpleado === 'ADM' && (
                    <div className="dropdown mt-2">
                      <button
                        className="btn btn-sm btn-outline-secondary dropdown-toggle"
                        type="button"
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                      >
                        Cambiar estado
                      </button>
                      <ul className="dropdown-menu">
                        <li><button className="dropdown-item" onClick={() => actualizarEstadoPedido(p.id, 'Pendiente')}>🟡 Pendiente</button></li>
                        <li><button className="dropdown-item" onClick={() => actualizarEstadoPedido(p.id, 'Solicitado')}>🔵 Solicitado</button></li>
                        <li><button className="dropdown-item" onClick={() => actualizarEstadoPedido(p.id, 'Aprobado')}>🟢 Aprobado</button></li>
                      </ul>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 📦 Modal de nuevo pedido */}
      {mostrarPedido && (
        <div className="modal show fade d-block" tabIndex="-1">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Nuevo Pedido Médico</h5>
                <button type="button" className="btn-close" onClick={() => setMostrarPedido(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Práctica Médica</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={practica}
                    onChange={(e) => setPractica(e.target.value)}
                  ></textarea>
                </div>
                <div className="mb-3">
                  <label className="form-label">Firmado por</label>
                  <input type="text" className="form-control" value={firmante} disabled />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setMostrarPedido(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={realizarPedido}>Guardar Pedido</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
