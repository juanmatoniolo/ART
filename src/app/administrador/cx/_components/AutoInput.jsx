import styles from "../cx-common.module.css";

export default function AutoInput({
  canonName,
  value,
  onChange,
  onBlur,
  suggestions,
  placeholder,
  autoComplete,
  disabled,
  inputMode,
}) {
  return (
    <>
      <input
        className={styles.input}
        name={canonName}
        autoComplete={autoComplete || "on"}
        value={value ?? ""}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder || "Completar…"}
        disabled={disabled}
        list={`dl-${canonName}`}
        inputMode={inputMode}
      />
      <datalist id={`dl-${canonName}`}>
        {(suggestions?.[canonName] || []).map((opt) => (
          <option value={opt} key={opt} />
        ))}
      </datalist>
    </>
  );
}