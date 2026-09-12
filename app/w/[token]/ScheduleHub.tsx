"use client";

import { useState } from "react";
import type { ClassroomData } from "@/lib/classroom";
import { CourseSchedule } from "./CourseSchedule";
import { TeacherAgenda } from "./TeacherAgenda";

export function ScheduleHub({ data, update, readOnly }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void; readOnly: boolean }) {
  const [view, setView] = useState<"class" | "mine">("class");
  return <div className="schedule-hub">
    <nav className="schedule-hub-switch" aria-label="课程日程视图">
      <button className={view === "class" ? "active" : ""} type="button" onClick={() => setView("class")}>班级课表</button>
      <button className={view === "mine" ? "active" : ""} type="button" onClick={() => setView("mine")}>我的日程与留痕</button>
    </nav>
    {view === "class" ? <CourseSchedule data={data} update={update} readOnly={readOnly} /> : <TeacherAgenda data={data} update={update} readOnly={readOnly} />}
  </div>;
}
