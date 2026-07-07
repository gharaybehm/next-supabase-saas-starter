interface StepIndicatorProps {
  step: number;
  total?: number;
}

export default function StepIndicator({ step, total = 4 }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 w-10 rounded-full transition-colors ${i < step ? 'bg-terracotta' : 'bg-ink/10'}`}
        />
      ))}
    </div>
  );
}
