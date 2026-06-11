"use client";

import { CheckboxChip } from "@/components/ui/field";

/** RHF-friendly controlled multi-select chip group. */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T[];
  onChange: (value: T[]) => void;
}) {
  function toggle(option: T) {
    onChange(
      value.includes(option)
        ? value.filter((v) => v !== option)
        : [...value, option],
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <CheckboxChip
          key={option}
          label={option}
          selected={value.includes(option)}
          onToggle={() => toggle(option)}
        />
      ))}
    </div>
  );
}
