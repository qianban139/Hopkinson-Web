// src/shared/components/SliderInputCombo.tsx
// 滑块 + 数字输入框组合组件，支持双向同步
import { useState, useEffect, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';

interface SliderInputComboProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  unit?: string;
  label?: string;
  icon?: React.ReactNode;
  color?: string;
  formatDisplay?: (value: number) => string;
}

export default function SliderInputCombo({
  value,
  onChange,
  min,
  max,
  step,
  disabled = false,
  unit = '',
  label,
  icon,
  color = '#00F5FF',
  formatDisplay,
}: SliderInputComboProps) {
  const [inputValue, setInputValue] = useState(String(value));
  const [isFocused, setIsFocused] = useState(false);

  // 外部值变化时同步到输入框（非焦点状态）
  useEffect(() => {
    if (!isFocused) {
      setInputValue(String(value));
    }
  }, [value, isFocused]);

  const clamp = useCallback((v: number) => {
    return Math.min(max, Math.max(min, Math.round(v / step) * step));
  }, [min, max, step]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputConfirm = () => {
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed)) {
      const clamped = clamp(parsed);
      onChange(clamped);
      setInputValue(String(clamped));
    } else {
      setInputValue(String(value));
    }
    setIsFocused(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleInputConfirm();
    } else if (e.key === 'Escape') {
      setInputValue(String(value));
      setIsFocused(false);
    }
  };

  const displayValue = formatDisplay ? formatDisplay(value) : `${value}`;

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex justify-between items-center">
          <label className="text-sm text-white/70 flex items-center gap-2">
            {icon}
            {label}
          </label>
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={isFocused ? inputValue : displayValue}
              onChange={handleInputChange}
              onFocus={() => { setIsFocused(true); setInputValue(String(value)); }}
              onBlur={handleInputConfirm}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              className="w-20 text-right text-sm font-mono px-2 py-0.5 rounded bg-[#0A2540] border border-[#00F5FF]/30 text-white focus:outline-none focus:border-[#00F5FF] transition-colors disabled:opacity-50"
              style={{ color }}
            />
            {unit && <span className="text-xs text-white/50">{unit}</span>}
          </div>
        </div>
      )}
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(clamp(v))}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
      />
    </div>
  );
}
