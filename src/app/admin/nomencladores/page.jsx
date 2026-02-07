'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import NomencladorNacional from '@/components/nacional/page';
import ConveniosArt from '@/components/convenios/page';
import NomencladorBioq from '@/components/bioquimica/page';
import NomencladorAoter from '@/components/aoter/page';
import styles from './page.module.css';

export default function NomencladorGlobal() {
  const [activeTab, setActiveTab] = useState('nacional');

  const tabs = useMemo(
    () => [
      { key: 'nacional', label: 'Nomenclador Nacional' },
      { key: 'convenios', label: 'Convenios ART' },
      { key: 'bioq', label: 'Bioquímica' },
      { key: 'aoter', label: 'AOTER' },
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
      <section className={styles.card} aria-label="Nomencladores">
        {/* Header (sobrio) */}
        <div className={styles.cardHeader}>
          <h1 className={styles.title}>Nomencladores</h1>
          <p className={styles.subtitle}>
            Seleccione una sección para consultar y gestionar información.
          </p>
        </div>

        {/* Tabs */}
        <div className={styles.tabsWrap}>
          <ul className={styles.tabs} role="tablist" aria-label="Secciones de nomencladores">
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
            {activeTab === 'nacional' && (
              <motion.div
                key="nacional"
                variants={variants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                <NomencladorNacional />
              </motion.div>
            )}

            {activeTab === 'convenios' && (
              <motion.div
                key="convenios"
                variants={variants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                <ConveniosArt />
              </motion.div>
            )}

            {activeTab === 'bioq' && (
              <motion.div
                key="bioq"
                variants={variants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                <NomencladorBioq />
              </motion.div>
            )}

            {activeTab === 'aoter' && (
              <motion.div
                key="aoter"
                variants={variants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                <NomencladorAoter />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </main>
  );
}
