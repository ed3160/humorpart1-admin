"use client";

import type { NavFilter } from "./AdminShell";

export default function FkLink({
  label,
  id,
  section,
  field,
  navigateTo,
}: {
  label: string;
  id: string;
  section: string;
  field: string;
  navigateTo: (section: string, filter?: NavFilter) => void;
}) {
  return (
    <button
      onClick={() => navigateTo(section, { field, value: id })}
      className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
      title={`View in ${section} (${id})`}
    >
      {label}
    </button>
  );
}
