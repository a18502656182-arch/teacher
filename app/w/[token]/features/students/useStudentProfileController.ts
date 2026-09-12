"use client";

import { useMemo, useState } from 'react';
import type { CareProfile, ClassroomData, Guardian, Student } from '@/lib/classroom';
import { applyStudentProfile } from './profile';

export type StudentProfileBindings = { student: Student; data: ClassroomData; update: (fn: (data: ClassroomData) => ClassroomData) => void; onClose: () => void };

/** Local form state stays independent of either theme. update applies a local draft;
 * it does not acknowledge a server save. The workspace owns that lifecycle.
 */
export function useStudentProfileController({ student, data, update, onClose }: StudentProfileBindings) {
  const classId = data.activeClassId ?? data.rosterClasses?.[0]?.id ?? "";
  const [residence, setResidence] = useState(student.residence ?? "未填");
  const [tags, setTags] = useState((student.tags ?? []).join("、"));
  const [guardians, setGuardians] = useState<Guardian[]>(() => (data.guardians ?? []).filter((item) => item.studentId === student.id && (!item.classId || item.classId === classId)));
  const [care, setCare] = useState<CareProfile[]>(() => (data.careProfiles ?? []).filter((item) => item.studentId === student.id && (!item.classId || item.classId === classId)));
  const [message, setMessage] = useState("");
  const visibleCare = useMemo(() => care, [care]);
  const attendanceHistory = useMemo(() => (data.attendanceRecords ?? []).filter((item) => item.classId === classId && item.studentId === student.id).toSorted((a, b) => b.date.localeCompare(a.date)).slice(0, 24), [classId, data.attendanceRecords, student.id]);
  function save() {
    const draft = { residence, tags, guardians, care };
    const checked = applyStudentProfile(data, student.id, classId, draft);
    if (checked.error) return setMessage(checked.error);
    update(current => {
      const result = applyStudentProfile(current, student.id, classId, draft);
      return result.data ?? current;
    });
    onClose();
  }
  return { residence, setResidence, tags, setTags, guardians, setGuardians, care, setCare, message, visibleCare, attendanceHistory, save };
}
