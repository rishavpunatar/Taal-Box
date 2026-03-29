interface SliderFieldProps {
  id: string
  label: string
  min: number
  max: number
  step?: number
  value: number
  valueLabel: string
  onChange: (value: number) => void
}

export function SliderField({
  id,
  label,
  min,
  max,
  step = 1,
  value,
  valueLabel,
  onChange,
}: SliderFieldProps) {
  return (
    <label className="slider-field" htmlFor={id}>
      <span className="slider-field__meta">
        <span>{label}</span>
        <strong>{valueLabel}</strong>
      </span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}
