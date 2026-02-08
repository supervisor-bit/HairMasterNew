interface AvatarProps {
  jmeno: string;
  prijmeni: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-xl',
};

// Generate consistent color from name
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-green-500',
    'bg-orange-500',
    'bg-red-500',
  ];
  return colors[Math.abs(hash) % colors.length];
}

export default function Avatar({ jmeno, prijmeni, size = 'md', className = '' }: AvatarProps) {
  const initials = `${jmeno.charAt(0)}${prijmeni.charAt(0)}`.toUpperCase();
  const colorClass = stringToColor(jmeno + prijmeni);

  return (
    <div
      className={`${sizeClasses[size]} ${colorClass} ${className} rounded-full flex items-center justify-center text-white font-semibold shadow-sm`}
    >
      {initials}
    </div>
  );
}
