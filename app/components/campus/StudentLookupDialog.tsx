"use client";

import { useMemo } from "react";
import type { Student } from "@/lib/classroom";
import { ThemeBoundary } from "@/app/components/workbench/theme/ThemeBoundary";
import { StudentPicker } from "@/app/components/workbench/ui/StudentPicker";

export function StudentLookupDialog({ title, subtitle, students, selectedId, allowClear, clearLabel = "清空选择", onPick, onClear, onClose }: { title: string; subtitle?: string; students: Student[]; selectedId?: string; allowClear?: boolean; clearLabel?: string; onPick: (student: Student) => void; onClear?: () => void; onClose: () => void }) {
  const items = useMemo(() => students.map(student => ({
    id: student.id,
    name: student.name,
    studentNo: student.studentNo,
    group: student.group,
    seat: student.seat,
  })), [students]);

  return <ThemeBoundary>
    <StudentPicker
      open
      title={title}
      description={subtitle}
      items={items}
      selectedIds={selectedId ? [selectedId] : []}
      allowEmptySelection={allowClear}
      clearLabel={clearLabel}
      confirmLabel="使用所选学生"
      onConfirm={(ids) => {
        const selected = students.find(student => student.id === ids[0]);
        if (selected) onPick(selected);
        else onClear?.();
        onClose();
      }}
      onRequestClose={onClose}
    />
  </ThemeBoundary>;
}
