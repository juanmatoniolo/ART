'use client';

import MedicacionyDescartables from '../components/MedicacionyDescartables';
import s from '../farmaciaDashboard.module.css';

export default function CatalogoPage() {
  return (
    <div className={s.panel}>
      <MedicacionyDescartables />
    </div>
  );
}
