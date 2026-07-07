export interface AvatarPerson {
  initials: string;
  tone?: 'ink' | 'terracotta';
}

interface AvatarStackProps {
  people: AvatarPerson[];
  max?: number;
  size?: number;
}

export default function AvatarStack({ people, max = 2, size = 24 }: AvatarStackProps) {
  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;

  return (
    <div className="flex items-center" style={{ marginLeft: 6 }}>
      {shown.map((person, i) => (
        <div
          key={i}
          className={`flex items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-white ${
            person.tone === 'terracotta' ? 'bg-terracotta' : 'bg-ink'
          }`}
          style={{ width: size, height: size, marginLeft: -6, zIndex: shown.length - i }}
        >
          {person.initials}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="flex items-center justify-center rounded-full border-2 border-white bg-zinc-300 text-[10px] font-semibold text-zinc-700"
          style={{ width: size, height: size, marginLeft: -6 }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
