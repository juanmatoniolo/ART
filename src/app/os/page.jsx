'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// Importa los componentes que crearás para OS
// import NomencladorOS from '@/components/os/nomenclador/page';
// import FacturacionOS from '@/components/os/facturacion/page';
import styles from './page.module.css'; // o un módulo CSS específico

// Placeholders mientras creas los componentes
const NomencladorOS = () => <div>Nomenclador Obras Sociales (placeholder)</div>;
const FacturacionOS = () => <div>Facturación Obras Sociales (placeholder)</div>;

export default function OSDashboard() {
  const [activeTab, setActiveTab] = useState('nomenclador');

  const tabs = useMemo(
    () => [
      { key: 'nomenclador', label: 'Nomenclador OS' },
      { key: 'facturacion', label: 'Facturación OS' },
    ],
    []
  );

  const variants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
  };

  const panelId = `panel-${activeTab}`;

  return (
    <main className={styles.wrapper}>
      <section className={styles.card} aria-label="Obras Sociales">
        <div className={styles.cardHeader}>
          <h1 className={styles.title}>Obras Sociales</h1>
          {/* Puedes agregar botones de acción adicionales aquí */}
        </div>

        {/* Tabs */}
        <div className={styles.tabsWrap}>
          <ul className={styles.tabs} role="tablist" aria-label="Secciones de Obras Sociales">
            {tabs.map((tab) => {
              const selected = activeTab === tab.key;
              return (
                <li key={tab.key} className={styles.tabItem}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls={`panel-${tab.key}`}
                    className={`${styles.tabButton} ${selected ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Contenido */}
        <div
          className={styles.tabContent}
          role="tabpanel"
          id={panelId}
          aria-live="polite"
        >
          <AnimatePresence mode="wait">
            {activeTab === 'nomenclador' && (
              <motion.div
                key="nomenclador"
                variants={variants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                <NomencladorOS />
              </motion.div>
            )}

            {activeTab === 'facturacion' && (
              <motion.div
                key="facturacion"
                variants={variants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                <FacturacionOS />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </main>
  );
}