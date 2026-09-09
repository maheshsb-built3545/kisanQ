export function Spinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'text-sm',
    md: 'text-xl',
    lg: 'text-3xl',
  };

  return (
    <span className={`material-symbols-outlined animate-spin ${sizes[size] || sizes.md} ${className}`}>
      autorenew
    </span>
  );
}
