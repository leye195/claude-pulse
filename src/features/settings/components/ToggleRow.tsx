interface ToggleRowProps {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}

export function ToggleRow({ label, checked, disabled, onChange }: ToggleRowProps) {
  return (
    <label
      className={`flex items-center justify-between py-2 ${
        disabled ? "opacity-50" : "cursor-pointer"
      }`}
    >
      <span className="text-sm text-(--text-primary)">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="cursor-pointer"
      />
    </label>
  );
}
