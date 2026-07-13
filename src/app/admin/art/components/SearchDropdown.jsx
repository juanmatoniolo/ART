import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "../page.module.css";

export default function SearchDropdown({
  items = [],
  loading = false,
  selectedItem,
  onSelect,
  placeholder = "Buscar...",
  label = "",
  renderItem = (item) => item.label,
  renderMeta = (item) => "",
  filterFn = (item, query) => true,
  getDisplayValue = (item) => item.label,
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);

  // Sincronizar query con el item seleccionado
  useEffect(() => {
    if (selectedItem) {
      setQuery(getDisplayValue(selectedItem));
    } else {
      setQuery("");
    }
  }, [selectedItem, getDisplayValue]);

  // Calcular posición del dropdown
  useEffect(() => {
    if (isOpen && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [isOpen, query]);

  // Filtrar items
  const filtered = items.filter((item) => filterFn(item, query));

  const handleSelect = (item) => {
    onSelect(item);
    setQuery(getDisplayValue(item));
    setIsOpen(false);
  };

  const handleClear = () => {
    onSelect(null);
    setQuery("");
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className={styles.searchWrapper} ref={wrapperRef}>
      {label && <label className={styles.searchLabel}>{label}</label>}

      <div className={styles.searchInputContainer}>
        <input
          ref={inputRef}
          type="text"
          className={styles.searchInput}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            if (selectedItem) onSelect(null); // deseleccionar al escribir
          }}
          onFocus={() => setIsOpen(true)}
        />
        {selectedItem && (
          <button className={styles.clearBtn} onClick={handleClear}>
            ✕
          </button>
        )}
      </div>

      {loading && <span className={styles.searchBadge}>Cargando...</span>}

      {isOpen &&
        createPortal(
          <div
            className={styles.searchDropdown}
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: position.width,
              maxHeight: 280,
              overflowY: "auto",
              zIndex: 999999,
            }}
          >
            {filtered.length > 0 ? (
              <>
                <div className={styles.dropdownHeader}>
                  {filtered.length} resultado{filtered.length > 1 ? "s" : ""}
                </div>
                {filtered.map((item, index) => (
                  <button
                    key={item.id || index}
                    className={styles.dropdownItem}
                    onMouseDown={() => handleSelect(item)}
                  >
                    <span className={styles.itemName}>{renderItem(item)}</span>
                    <span className={styles.itemMeta}>{renderMeta(item)}</span>
                  </button>
                ))}
              </>
            ) : (
              <div className={styles.emptyState}>
                No se encontró "{query}"
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}