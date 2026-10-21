export default function NavUserGreeting({ name, className = '' }) {
  if (!name) return null;

  return (
    <span
      className={`font-semibold text-ink-900/80 truncate ${className}`}
      title={`Hi, ${name}`}
    >
      Hi, <span className="text-brand-600">{name}</span>
    </span>
  );
}
