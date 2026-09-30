import { Check, Minus } from 'lucide-react';

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** "Parcial": alguns itens do grupo marcados (mostra um traço). */
  indeterminate?: boolean;
  label?: React.ReactNode;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  /** Nome para leitores de tela quando não há texto visível. */
  ariaLabel?: string;
}

/**
 * Checkbox no visual do sistema: caixa escura com a mesma borda dos campos,
 * e verde de destaque (#5DD62C) quando marcada.
 * Usa um <input type="checkbox"> real escondido, então teclado (Espaço/Tab)
 * e leitores de tela continuam funcionando.
 */
export function Checkbox({ checked, onChange, indeterminate, label, disabled, size = 'md', className = '', ariaLabel }: Props) {
  const box = size === 'sm' ? 'w-4 h-4 rounded' : 'w-[18px] h-[18px] rounded-[5px]';
  const icone = size === 'sm' ? 11 : 12;
  const marcado = checked || indeterminate;

  return (
    <label
      className={`inline-flex items-center gap-2 select-none ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-checked={indeterminate ? 'mixed' : checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden
        className={`${box} flex-shrink-0 flex items-center justify-center border transition-colors
          peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40 peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-background
          ${marcado ? 'bg-accent border-accent text-accent-foreground' : 'bg-muted border-white/15 hover:border-accent/60'}`}
      >
        {indeterminate ? <Minus size={icone} strokeWidth={3} /> : checked ? <Check size={icone} strokeWidth={3} /> : null}
      </span>
      {label !== undefined && <span className="text-xs text-gray-400">{label}</span>}
    </label>
  );
}
