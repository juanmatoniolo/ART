'use client';
import s from '../farmaciaDashboard.module.css';

const tabs = [
  { id: 'dashboard', label: 'Inicio' },
  { id: 'stock', label: 'Stock' },
  { id: 'movimientos', label: 'Movim.' },
  { id: 'catalogo', label: 'Catálogo' },
  { id: 'exportar', label: 'Exportar' },
];

export default function TabNav({ activeTab, onTabChange }) {
  return (
    <nav className={s.mainNav} style={{ width: '100%', padding: '0' }}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`${s.tabBtn} ${activeTab === tab.id ? s.tabActive : ''}`}
          onClick={() => onTabChange(tab.id)}
          style={{ flex: 1, textAlign: 'center', justifyContent: 'center' }}
        >
          <span className={s.tabLabel}>{tab.label}</span>
          {activeTab === tab.id && <span className={s.tabUnderline} />}
        </button>
      ))}
    </nav>
  );
}