import { useEffect, useState, useMemo } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import { safeNum } from '../../Facturacion/utils/calculos';

export default function useDoctorDashboard(fechaDesde, fechaHasta) {
  const [facturas, setFacturas] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const factRef = ref(db, 'Facturacion');
    return onValue(factRef, (snap) => {
      setFacturas(snap.exists() ? snap.val() : {});
      setLoading(false);
    });
  }, []);

  const stats = useMemo(() => {
    const desdeTs = fechaDesde ? new Date(fechaDesde).setHours(0,0,0,0) : null;
    const hastaTs = fechaHasta ? new Date(fechaHasta).setHours(23,59,59,999) : null;

    let totalHonorarios = 0;
    let totalGastos = 0;
    const doctorMap = new Map(); // key: nombreDoctor, value: { count: 0, total: 0 }

    Object.values(facturas).forEach((fact) => {
      // Determinar fecha de la factura (usar la misma lógica que en items)
      const fecha = fact.cerradoAt || fact.updatedAt || fact.createdAt || 0;
      if (desdeTs && fecha < desdeTs) return;
      if (hastaTs && fecha > hastaTs) return;

      // Procesar prácticas
      (fact.practicas || []).forEach(p => {
        const honor = safeNum(p.honorarioMedico);
        const gasto = safeNum(p.gastoSanatorial);
        totalHonorarios += honor;
        totalGastos += gasto;
        if (honor > 0 && p.prestadorNombre) {
          const name = p.prestadorNombre.trim();
          if (!doctorMap.has(name)) doctorMap.set(name, { count: 0, total: 0 });
          const doc = doctorMap.get(name);
          doc.count += 1;
          doc.total += honor;
        }
      });

      // Cirugías
      (fact.cirugias || []).forEach(c => {
        const honor = safeNum(c.honorarioMedico);
        const gasto = safeNum(c.gastoSanatorial);
        totalHonorarios += honor;
        totalGastos += gasto;
        if (honor > 0 && c.prestadorNombre) {
          const name = c.prestadorNombre.trim();
          if (!doctorMap.has(name)) doctorMap.set(name, { count: 0, total: 0 });
          const doc = doctorMap.get(name);
          doc.count += 1;
          doc.total += honor;
        }
      });

      // Laboratorios
      (fact.laboratorios || []).forEach(l => {
        const honor = safeNum(l.honorarioMedico); // en laboratorios, el total va a honorario
        const gasto = safeNum(l.gastoSanatorial);
        totalHonorarios += honor;
        totalGastos += gasto;
        if (honor > 0 && l.prestadorNombre) {
          const name = l.prestadorNombre.trim();
          if (!doctorMap.has(name)) doctorMap.set(name, { count: 0, total: 0 });
          const doc = doctorMap.get(name);
          doc.count += 1;
          doc.total += honor;
        }
      });

      // Medicamentos y descartables (son solo gastos, no tienen honorarios)
      (fact.medicamentos || []).forEach(m => {
        totalGastos += safeNum(m.gastoSanatorial || m.total);
      });
      (fact.descartables || []).forEach(d => {
        totalGastos += safeNum(d.gastoSanatorial || d.total);
      });
    });

    // Convertir mapa a array y ordenar por total descendente
    const doctores = Array.from(doctorMap.entries()).map(([nombre, data]) => ({
      nombre,
      ...data,
    })).sort((a, b) => b.total - a.total);

    return {
      totalHonorarios,
      totalGastos,
      doctores,
    };
  }, [facturas, fechaDesde, fechaHasta]);

  return { stats, loading };
}