"use client";

import type { NavFilter } from "./AdminShell";

type Section = "profiles" | "images" | "captions";

export default function FkLink({
  label,
  id,
  section,
  field,
  navigateTo,
}: {
  label: string;
  id: string;
  section: Section;
  field: string;
  navigateTo: (section: Section, filter?: NavFilter) => void;
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
