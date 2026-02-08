import { ReactNode } from 'react';

type BadgeVariant = 'material' | 'oxidant' | 'product' | 'service' | 'default';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  material: 'bg-accent-50 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400 border-accent-100 dark:border-accent-900',
  oxidant: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900',
  product: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900',
  service: 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-100 dark:border-purple-900',
  default: 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-100 dark:border-gray-700',
};

export default function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span className={`
      inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border
      ${variantStyles[variant]}
      ${className}
    `}>
      {children}
    </span>
  );
}
