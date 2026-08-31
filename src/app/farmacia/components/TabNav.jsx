
'use client';
import s from '../styles/TabNav.module.css';
import Icon from './Icon';

const tabs = [
  { id: 'dashboard', label: 'Inicio', icon: 'home' },
  { id: 'stock', label: 'Stock', icon: 'box' },
  { id: 'movimientos', label: 'Movim.', icon: 'list' },
  { id: 'catalogo', label: 'Catálogo', icon: 'tag' },
  { id: 'exportar', label: 'Exportar', icon: 'download' },
];

export default function TabNav({ activeTab, onTabChange }) {
  return (
    <nav className={s.mainNav}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`${s.tabBtn} ${activeTab === tab.id ? s.tabActive : ''}`}
          onClick={() => onTabChange(tab.id)}
          aria-current={activeTab === tab.id ? 'page' : undefined}
        >
          <span className={s.tabIcon}>
            <Icon name={tab.icon} size={18} />
          </span>
          <span className={s.tabLabel}>{tab.label}</span>
          {activeTab === tab.id && <span className={s.tabUnderline} />}
        </button>
      ))}
    </nav>
  );
}