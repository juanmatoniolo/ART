'use client';
import { useState } from 'react';
import NomencladorNacional from '../../../components/nacional/page';
import ConveniosArt from '../../../components/convenios/page';
import NomencladorBioq from '../../../components/bioquimica/page';
import NomencladorAoter from '../../../components/aoter/page';
import styles from './page.module.css';

export default function NomencladorGlobal() {
  const [activeTab, setActiveTab] = useState('nacional');

  const tabs = [
    { key: 'nacional', label: 'Nomenclador Nacional' },
    { key: 'convenios', label: 'Convenios ART' },
    { key: 'bioq', label: 'Bioquímica' },
    { key: 'aoter', label: 'AOTER' },
  ];

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <ul className={styles.tabs}>
          {tabs.map((tab) => (
            <li key={tab.key}>
              <button
                className={`${styles.tabButton} ${activeTab === tab.key ? styles.activeTab : ''
                  }`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            </li>
          ))}
        </ul>

        <div className={styles.tabContent}>
          {activeTab === 'nacional' && <NomencladorNacional />}
          {activeTab === 'convenios' && <ConveniosArt />}
          {activeTab === 'bioq' && <NomencladorBioq />}
          {activeTab === 'aoter' && <NomencladorAoter />}
        </div>
      </div>
    </div>
  );
}
