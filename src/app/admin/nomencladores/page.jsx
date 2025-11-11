'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import NomencladorNacional from '../../../components/nacional/page';
import ConveniosArt from '../../../components/convenios/page';
import NomencladorBioq from '../../../components/bioquimica/page';
import NomencladorAoter from '../../../components/aoter/page';
import styles from './page.module.css';

export default function NomencladorGlobal() {
  const [activeTab, setActiveTab] = useState('nacional');

  // ✅ Definimos las pestañas una sola vez
  const tabs = useMemo(
    () => [
      { key: 'nacional', label: 'Nomenclador Nacional' },
      { key: 'convenios', label: 'Convenios ART' },
      { key: 'bioq', label: 'Bioquímica' },
      { key: 'aoter', label: 'AOTER' },
    ],
    []
  );

  // ✅ Variantes para animaciones (fade suave)
  const variants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
  };

  return (
    <main className={styles.wrapper}>
      <section className={styles.card}>
        {/* === NAV TABS === */}
        <ul className={styles.tabs}>
          {tabs.map((tab) => (
            <li key={tab.key}>
              <button
                className={`${styles.tabButton} ${
                  activeTab === tab.key ? styles.activeTab : ''
                }`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            </li>
          ))}
        </ul>

        {/* === CONTENIDO === */}
        <div className={styles.tabContent}>
          <AnimatePresence mode="wait">
            {activeTab === 'nacional' && (
              <motion.div
                key="nacional"
                variants={variants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ duration: 0.25, ease: 'easeOut' }}
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
                transition={{ duration: 0.25, ease: 'easeOut' }}
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
                transition={{ duration: 0.25, ease: 'easeOut' }}
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
                transition={{ duration: 0.25, ease: 'easeOut' }}
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
