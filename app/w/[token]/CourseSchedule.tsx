"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { makeId, scheduleTermLabel } from "@/lib/classroom";
import type { ClassroomData, DailyFocus, ScheduleConfig, ScheduleEvent, ScheduleWeek } from "@/lib/classroom";
import { WorkbenchPageHeader } from "./WorkbenchPageHeader";

const defaultConfig: ScheduleConfig = {
  schoolYear: "自定义学年/学段",
  term: "自定义学期",
  termStartMonth: "",
  termEndMonth: "",
  termNote: "不同地区、不同学校开学时间不同，这里由老师自己填写。",
  days: ["周一", "周二", "周三", "周四", "周五"],
  periods: [
    { label: "早读", time: "08:00-08:20" },
    { label: "第1节", time: "08:30-09:10" },
    { label: "第2节", time: "09:20-10:00" },
    { label: "第3节", time: "10:20-11:00" },
    { label: "第4节", time: "11:10-11:50" },
    { label: "午间", time: "12:00-13:30" },
    { label: "第5节", time: "14:00-14:40" },
    { label: "延时", time: "16:20-17:30" },
  ],
};

const eventTypes: ScheduleEvent["type"][] = ["班会", "活动", "考试", "放假", "家校", "其他"];
const focusStatuses: DailyFocus["status"][] = ["待处理", "进行中", "已完成"];

function courseNameHue(subject: string) {
  return Array.from(subject).reduce((hash, char) => (hash * 31 + (char.codePointAt(0) ?? 0)) % 360, 17);
}

function monthIndex(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return 0;
  return year * 12 + monthNumber - 1;
}

function monthFromIndex(index: number) {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function termRange(config: ScheduleConfig, fallbackYear: number) {
  const fallbackStart = `${fallbackYear}-08`;
  const fallbackEnd = `${fallbackYear + 1}-01`;
  const rawStart = config.termStartMonth || fallbackStart;
  const rawEnd = config.termEndMonth || fallbackEnd;
  const start = monthIndex(rawStart) <= monthIndex(rawEnd) ? rawStart : rawEnd;
  const end = monthIndex(rawStart) <= monthIndex(rawEnd) ? rawEnd : rawStart;
  return { start, end };
}

function termMonths(config: ScheduleConfig, fallbackYear: number) {
  const { start, end } = termRange(config, fallbackYear);
  const startIndex = monthIndex(start);
  const endIndex = monthIndex(end);
  const length = Math.min(24, Math.max(1, endIndex - startIndex + 1));
  return Array.from({ length }, (_, index) => monthFromIndex(startIndex + index));
}

function clampMonthToTerm(month: string, config: ScheduleConfig, fallbackYear: number) {
  const { start, end } = termRange(config, fallbackYear);
  if (monthIndex(month) < monthIndex(start)) return start;
  if (monthIndex(month) > monthIndex(end)) return end;
  return month;
}

function normalizeTermConfig(config: ScheduleConfig, fallbackYear: number) {
  const { start, end } = termRange(config, fallbackYear);
  return { ...config, termStartMonth: start, termEndMonth: end };
}

export function CourseSchedule({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
  const storedWeeks = useMemo(() => data.scheduleWeeks ?? [], [data.scheduleWeeks]);
  const initialConfig = data.scheduleConfig ?? defaultConfig;
  const initialBaseMonth = initialConfig.termStartMonth || storedWeeks[0]?.month || new Date().toISOString().slice(0, 7);
  const initialYear = Number(initialBaseMonth.slice(0, 4)) || new Date().getFullYear();
  const initialMonth = clampMonthToTerm(storedWeeks[0]?.month ?? initialBaseMonth, initialConfig, initialYear);
  const initialStoredWeek = storedWeeks.find((item) => item.month === initialMonth);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [calendarYear, setCalendarYear] = useState(Number(initialMonth.slice(0, 4)) || new Date().getFullYear());
  const [selectedWeek, setSelectedWeek] = useState(initialStoredWeek?.weekOfMonth ?? 1);
  const [isEditingTerm, setIsEditingTerm] = useState(false);
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [isEditingEvents, setIsEditingEvents] = useState(false);
  const [isEditingFocuses, setIsEditingFocuses] = useState(false);
  const [draftConfig, setDraftConfig] = useState<ScheduleConfig>(defaultConfig);
  const [draftCourses, setDraftCourses] = useState<string[][]>([]);
  const [draftEvents, setDraftEvents] = useState<ScheduleEvent[]>([]);
  const [draftFocuses, setDraftFocuses] = useState<DailyFocus[]>([]);
  const [newEvent, setNewEvent] = useState<Omit<ScheduleEvent, "id">>({ date: `${selectedMonth}-01`, title: "", type: "班会", detail: "" });
  const [newFocus, setNewFocus] = useState<Omit<DailyFocus, "id">>({ date: `${selectedMonth}-01`, focus: "", todo: "", status: "待处理" });

  const currentWeek = storedWeeks.find((item) => item.month === selectedMonth && item.weekOfMonth === selectedWeek);
  const weekDates = getWeekDates(selectedMonth, selectedWeek);
  const selectedKey = `${selectedMonth}-w${selectedWeek}`;
  const calendarConfig = isEditingTerm ? draftConfig : data.scheduleConfig ?? currentWeek?.config ?? defaultConfig;
  const monthOptions = useMemo(() => termMonths(calendarConfig, calendarYear), [calendarConfig, calendarYear]);
  const monthWeeks = useMemo(() => Array.from({ length: getWeeksInMonth(selectedMonth) }, (_, index) => {
    const week = index + 1;
    const stored = storedWeeks.find((item) => item.month === selectedMonth && item.weekOfMonth === week);
    return { week, stored, ...getWeekDates(selectedMonth, week) };
  }), [selectedMonth, storedWeeks]);

  const viewConfig = isEditingSchedule ? draftConfig : currentWeek?.config ?? data.scheduleConfig ?? defaultConfig;
  const viewCourses = isEditingSchedule ? draftCourses : normalizeCourses(currentWeek?.courses ?? data.courses ?? [], viewConfig);
  const storedEvents = currentWeek?.events ?? (data.scheduleEvents ?? []).filter((item) => item.date >= weekDates.startDate && item.date <= weekDates.endDate);
  const storedFocuses = currentWeek?.focuses ?? (data.dailyFocus ?? []).filter((item) => item.date >= weekDates.startDate && item.date <= weekDates.endDate);
  const viewEvents = (isEditingSchedule || isEditingEvents) ? draftEvents : storedEvents;
  const viewFocuses = (isEditingSchedule || isEditingFocuses) ? draftFocuses : storedFocuses;
  const todayIndex = Math.max(0, Math.min(viewConfig.days.length - 1, new Date().getDay() - 1));
  const todayCourses = viewCourses[todayIndex] ?? [];
  const filledCells = viewCourses.flat().filter((item) => item.trim()).length;
  const totalSlots = Math.max(1, viewConfig.days.length * viewConfig.periods.length);
  const courseColorMap = useMemo(() => {
    const subjects = Array.from(new Set(viewCourses.flat().map((item) => item.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-CN"));
    const usedHues = new Set<number>();
    const colors = new Map<string, CSSProperties>();

    subjects.forEach((subject) => {
      let hue = courseNameHue(subject);
      let attempts = 0;
      while (usedHues.has(hue) && attempts < 360) {
        hue = (hue + 47) % 360;
        attempts += 1;
      }
      usedHues.add(hue);
      colors.set(subject, { "--course-bg": `hsl(${hue} 62% 93%)` } as CSSProperties);
    });

    return colors;
  }, [viewCourses]);
  const currentTermRange = termRange(calendarConfig, calendarYear);

  useEffect(() => {
    if (isEditingSchedule || isEditingTerm || isEditingEvents || isEditingFocuses) {
      setNewEvent((draft) => ({ ...draft, date: weekDates.startDate }));
      setNewFocus((draft) => ({ ...draft, date: weekDates.startDate }));
      return;
    }
    const baseConfig = normalizeTermConfig(data.scheduleConfig ?? currentWeek?.config ?? defaultConfig, calendarYear);
    setDraftConfig(baseConfig);
    setDraftCourses(normalizeCourses(currentWeek?.courses ?? data.courses ?? [], baseConfig));
    setDraftEvents(currentWeek?.events ?? (data.scheduleEvents ?? []).filter((item) => item.date >= weekDates.startDate && item.date <= weekDates.endDate));
    setDraftFocuses(currentWeek?.focuses ?? (data.dailyFocus ?? []).filter((item) => item.date >= weekDates.startDate && item.date <= weekDates.endDate));
    setNewEvent((draft) => ({ ...draft, date: weekDates.startDate }));
    setNewFocus((draft) => ({ ...draft, date: weekDates.startDate }));
    setIsEditingSchedule(false);
  }, [selectedKey, isEditingSchedule, isEditingTerm, isEditingEvents, isEditingFocuses, calendarYear, currentWeek?.config, currentWeek?.courses, currentWeek?.events, currentWeek?.focuses, data.scheduleConfig, data.courses, data.scheduleEvents, data.dailyFocus, weekDates.startDate, weekDates.endDate]);

  function chooseMonth(month: string) {
    if (!month) return;
    setSelectedMonth(month);
    setSelectedWeek((week) => Math.min(week, getWeeksInMonth(month)));
    setCalendarYear(Number(month.slice(0, 4)) || calendarYear);
  }

  function normalizeCourses(courses: string[][], config: ScheduleConfig) {
    return config.days.map((_, dayIndex) => Array.from({ length: config.periods.length }, (__, period) => courses[dayIndex]?.[period] ?? ""));
  }

  function changeDraftConfig(patch: Partial<ScheduleConfig>) {
    setDraftConfig((current) => {
      const nextConfig = normalizeTermConfig({ ...current, ...patch }, calendarYear);
      if (patch.termStartMonth !== undefined || patch.termEndMonth !== undefined) {
        const nextMonth = clampMonthToTerm(selectedMonth, nextConfig, calendarYear);
        if (nextMonth !== selectedMonth) {
          setSelectedMonth(nextMonth);
          setCalendarYear(Number(nextMonth.slice(0, 4)) || calendarYear);
          setSelectedWeek((week) => Math.min(week, getWeeksInMonth(nextMonth)));
        }
      }
      setDraftCourses((courses) => normalizeCourses(courses, nextConfig));
      return nextConfig;
    });
  }

  function changeCourse(day: number, period: number, value: string) {
    setDraftCourses((courses) => normalizeCourses(courses, draftConfig).map((row, rowIndex) => rowIndex === day ? row.map((course, colIndex) => colIndex === period ? value : course) : row));
  }

  function editDay(index: number, value: string) {
    changeDraftConfig({ days: draftConfig.days.map((item, itemIndex) => itemIndex === index ? value : item) });
  }

  function addDay() {
    const nextLabel = draftConfig.days.length === 5 ? "周六" : draftConfig.days.length === 6 ? "周日" : `第${draftConfig.days.length + 1}天`;
    changeDraftConfig({ days: [...draftConfig.days, nextLabel] });
  }

  function removeDay(index: number) {
    if (draftConfig.days.length <= 1) return;
    const nextConfig = { ...draftConfig, days: draftConfig.days.filter((_, itemIndex) => itemIndex !== index) };
    setDraftConfig(nextConfig);
    setDraftCourses((courses) => normalizeCourses(courses.filter((_, itemIndex) => itemIndex !== index), nextConfig));
  }

  function editPeriod(index: number, patch: Partial<{ label: string; time: string }>) {
    changeDraftConfig({ periods: draftConfig.periods.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) });
  }

  function addPeriod() {
    changeDraftConfig({ periods: [...draftConfig.periods, { label: `第${draftConfig.periods.length + 1}节`, time: "" }] });
  }

  function removePeriod(index: number) {
    if (draftConfig.periods.length <= 1) return;
    setDraftConfig((current) => ({ ...current, periods: current.periods.filter((_, itemIndex) => itemIndex !== index) }));
    setDraftCourses((courses) => courses.map((row) => row.filter((_, itemIndex) => itemIndex !== index)));
  }

  function clearSchedule() {
    setDraftCourses(draftConfig.days.map(() => Array.from({ length: draftConfig.periods.length }, () => "")));
  }

  function addEvent() {
    if (!newEvent.title.trim() && !newEvent.detail.trim()) return;
    setDraftEvents((items) => [{ id: makeId("schedule-event"), ...newEvent, title: newEvent.title.trim() || "未命名活动" }, ...items]);
    setNewEvent((draft) => ({ ...draft, title: "", detail: "" }));
  }

  function addFocus() {
    if (!newFocus.focus.trim() && !newFocus.todo.trim()) return;
    setDraftFocuses((items) => [{ id: makeId("daily-focus"), ...newFocus, focus: newFocus.focus.trim() || "本周重点" }, ...items]);
    setNewFocus((draft) => ({ ...draft, focus: "", todo: "" }));
  }

  function startTermEdit() {
    const baseConfig = normalizeTermConfig(data.scheduleConfig ?? currentWeek?.config ?? defaultConfig, calendarYear);
    setDraftConfig(baseConfig);
    setIsEditingSchedule(false);
    setIsEditingEvents(false);
    setIsEditingFocuses(false);
    setIsEditingTerm(true);
  }

  function cancelTermEdit() {
    const baseConfig = normalizeTermConfig(data.scheduleConfig ?? currentWeek?.config ?? defaultConfig, calendarYear);
    setDraftConfig(baseConfig);
    setIsEditingTerm(false);
  }

  function saveTerm() {
    const nextConfig = normalizeTermConfig(draftConfig, calendarYear);
    const targetMonth = clampMonthToTerm(selectedMonth, nextConfig, calendarYear);
    const targetWeek = Math.min(selectedWeek, getWeeksInMonth(targetMonth));
    const termLabel = scheduleTermLabel(nextConfig);
    update((current) => {
      const activeClassId = current.activeClassId ?? current.rosterClasses?.[0]?.id;
      return {
        ...current,
        scheduleConfig: nextConfig,
        rosterClasses: current.rosterClasses?.map((item) => item.id === activeClassId ? { ...item, term: termLabel } : item),
      };
    });
    setDraftConfig(nextConfig);
    setSelectedMonth(targetMonth);
    setCalendarYear(Number(targetMonth.slice(0, 4)) || calendarYear);
    setSelectedWeek(targetWeek);
    setIsEditingTerm(false);
  }

  function startScheduleEdit() {
    const baseConfig = normalizeTermConfig(currentWeek?.config ?? data.scheduleConfig ?? defaultConfig, calendarYear);
    setDraftConfig(baseConfig);
    setDraftCourses(normalizeCourses(currentWeek?.courses ?? data.courses ?? [], baseConfig));
    setDraftEvents(currentWeek?.events ?? (data.scheduleEvents ?? []).filter((item) => item.date >= weekDates.startDate && item.date <= weekDates.endDate));
    setDraftFocuses(currentWeek?.focuses ?? (data.dailyFocus ?? []).filter((item) => item.date >= weekDates.startDate && item.date <= weekDates.endDate));
    setIsEditingTerm(false);
    setIsEditingEvents(false);
    setIsEditingFocuses(false);
    setIsEditingSchedule(true);
  }

  function cancelScheduleEdit() {
    const baseConfig = normalizeTermConfig(currentWeek?.config ?? data.scheduleConfig ?? defaultConfig, calendarYear);
    setDraftConfig(baseConfig);
    setDraftCourses(normalizeCourses(currentWeek?.courses ?? data.courses ?? [], baseConfig));
    setDraftEvents(currentWeek?.events ?? (data.scheduleEvents ?? []).filter((item) => item.date >= weekDates.startDate && item.date <= weekDates.endDate));
    setDraftFocuses(currentWeek?.focuses ?? (data.dailyFocus ?? []).filter((item) => item.date >= weekDates.startDate && item.date <= weekDates.endDate));
    setIsEditingSchedule(false);
  }

  function saveWeek() {
    const nextConfig = normalizeTermConfig(draftConfig, calendarYear);
    const targetMonth = clampMonthToTerm(selectedMonth, nextConfig, calendarYear);
    const targetWeek = Math.min(selectedWeek, getWeeksInMonth(targetMonth));
    const range = getWeekDates(targetMonth, targetWeek);
    const targetStoredWeek = storedWeeks.find((item) => item.month === targetMonth && item.weekOfMonth === targetWeek);
    const week: ScheduleWeek = {
      id: targetStoredWeek?.id ?? `sw-${targetMonth}-w${targetWeek}`,
      month: targetMonth,
      weekOfMonth: targetWeek,
      label: range.label,
      startDate: range.startDate,
      endDate: range.endDate,
      config: nextConfig,
      courses: normalizeCourses(draftCourses, nextConfig),
      events: draftEvents,
      focuses: draftFocuses,
    };
    update((current) => {
      const nextWeeks = [week, ...(current.scheduleWeeks ?? []).filter((item) => !(item.month === targetMonth && item.weekOfMonth === targetWeek))].sort((a, b) => a.startDate.localeCompare(b.startDate));
      const activeClassId = current.activeClassId ?? current.rosterClasses?.[0]?.id;
      const termLabel = scheduleTermLabel(nextConfig);
      return {
        ...current,
        scheduleWeeks: nextWeeks,
        scheduleConfig: nextConfig,
        courses: week.courses,
        scheduleEvents: nextWeeks.flatMap((item) => item.events),
        dailyFocus: nextWeeks.flatMap((item) => item.focuses),
        rosterClasses: current.rosterClasses?.map((item) => item.id === activeClassId ? { ...item, term: termLabel } : item),
      };
    });
    setDraftConfig(nextConfig);
    setSelectedMonth(targetMonth);
    setCalendarYear(Number(targetMonth.slice(0, 4)) || calendarYear);
    setSelectedWeek(targetWeek);
    setIsEditingSchedule(false);
  }

  function startEventsEdit() {
    setDraftEvents(storedEvents);
    setIsEditingEvents(true);
  }

  function cancelEventsEdit() {
    setDraftEvents(storedEvents);
    setIsEditingEvents(false);
  }

  function startFocusesEdit() {
    setDraftFocuses(storedFocuses);
    setIsEditingFocuses(true);
  }

  function cancelFocusesEdit() {
    setDraftFocuses(storedFocuses);
    setIsEditingFocuses(false);
  }

  function saveWeekSide(patch: Partial<Pick<ScheduleWeek, "events" | "focuses">>) {
    const baseConfig = currentWeek?.config ?? data.scheduleConfig ?? defaultConfig;
    const courses = normalizeCourses(currentWeek?.courses ?? data.courses ?? [], baseConfig);
    const week: ScheduleWeek = {
      id: currentWeek?.id ?? `sw-${selectedMonth}-w${selectedWeek}`,
      month: selectedMonth,
      weekOfMonth: selectedWeek,
      label: weekDates.label,
      startDate: weekDates.startDate,
      endDate: weekDates.endDate,
      config: baseConfig,
      courses,
      events: patch.events ?? storedEvents,
      focuses: patch.focuses ?? storedFocuses,
    };
    update((current) => {
      const nextWeeks = [week, ...(current.scheduleWeeks ?? []).filter((item) => !(item.month === selectedMonth && item.weekOfMonth === selectedWeek))].sort((a, b) => a.startDate.localeCompare(b.startDate));
      return { ...current, scheduleWeeks: nextWeeks, scheduleEvents: nextWeeks.flatMap((item) => item.events), dailyFocus: nextWeeks.flatMap((item) => item.focuses) };
    });
  }

  function saveEvents() {
    saveWeekSide({ events: draftEvents });
    setIsEditingEvents(false);
  }

  function saveFocuses() {
    saveWeekSide({ focuses: draftFocuses });
    setIsEditingFocuses(false);
  }

  return <div className="courseplan-page homework-bootstrap-preview">
    <WorkbenchPageHeader
      icon="🗓️"
      tone="sky"
      title="课程日程"
      description={`${scheduleTermLabel(calendarConfig)} · ${weekDates.startDate} 至 ${weekDates.endDate}`}
      actions={<div className="courseplan-heading-actions">
        {isEditingSchedule ? <><button className="courseplan-primary workbench-header-primary" onClick={saveWeek}>保存课表</button><button onClick={cancelScheduleEdit}>取消编辑</button></> : <button className="courseplan-primary workbench-header-primary" onClick={startScheduleEdit}>编辑本周课表</button>}
      </div>}
    />

    <section className="courseplan-toolbar workbench-page-context" aria-label="学期与周次">
      <div className="courseplan-term-summary">
        <span>学期档案</span>
        <b>{calendarConfig.schoolYear || "未命名档案"} · {calendarConfig.term || "未命名学期"}</b>
        <small>{currentTermRange.start} 至 {currentTermRange.end}{calendarConfig.termNote ? ` · ${calendarConfig.termNote}` : ""}</small>
      </div>
      <label className="courseplan-month-select">
        <span>月份</span>
        <select value={selectedMonth} onChange={(event) => chooseMonth(event.target.value)}>
          {monthOptions.map((month) => <option value={month} key={month}>{month.slice(0, 4)}年{month.slice(5)}月</option>)}
        </select>
      </label>
      <div className="courseplan-current-week">
        <span>当前周次</span>
        <b>{weekDates.label}</b>
        <small>{weekDates.startDate} 至 {weekDates.endDate}</small>
      </div>
      <div className="courseplan-toolbar-actions">
        {isEditingTerm ? <><button className="courseplan-primary" onClick={saveTerm}>保存学期</button><button onClick={cancelTermEdit}>取消</button></> : <button onClick={startTermEdit}>编辑学期</button>}
      </div>
    </section>

    {isEditingTerm && <section className="courseplan-term-form">
      <label><span>档案名称</span><input value={draftConfig.schoolYear} onChange={(event) => changeDraftConfig({ schoolYear: event.target.value })} /></label>
      <label><span>学期名称</span><input value={draftConfig.term} onChange={(event) => changeDraftConfig({ term: event.target.value })} /></label>
      <label><span>起始月份</span><input type="month" value={draftConfig.termStartMonth ?? ""} onChange={(event) => changeDraftConfig({ termStartMonth: event.target.value })} /></label>
      <label><span>结束月份</span><input type="month" value={draftConfig.termEndMonth ?? ""} onChange={(event) => changeDraftConfig({ termEndMonth: event.target.value })} /></label>
      <label className="wide"><span>说明</span><input value={draftConfig.termNote ?? ""} onChange={(event) => changeDraftConfig({ termNote: event.target.value })} /></label>
    </section>}

    <nav className="courseplan-weeks" aria-label="周次切换">
      {monthWeeks.map((item) => <button className={item.week === selectedWeek ? "active" : ""} key={item.week} onClick={() => setSelectedWeek(item.week)}>
        <b>第{item.week}周</b>
        <span>{item.startDate.slice(5)} 至 {item.endDate.slice(5)}</span>
        <em>{item.stored ? "已保存" : "未编辑"}</em>
      </button>)}
    </nav>

    <section className="courseplan-board">
      <header className="courseplan-section-head">
        <div><span>{isEditingSchedule ? "编辑课表" : "本周课表"}</span><h3>{weekDates.label}</h3></div>
        <div className="courseplan-table-actions">
          {isEditingSchedule ? <><button className="courseplan-primary" onClick={saveWeek}>保存课表</button><button onClick={cancelScheduleEdit}>取消</button><button className="courseplan-danger" onClick={clearSchedule}>清空课程</button><button onClick={addDay}>新增上课日</button><button onClick={addPeriod}>新增节次</button></> : null}
        </div>
      </header>
      <div className="courseplan-scroll">
        <div className="courseplan-table" style={{ gridTemplateColumns: `118px repeat(${viewConfig.days.length}, minmax(128px, 1fr))` }}>
          <div className="corner">节次</div>
          {viewConfig.days.map((day, dayIndex) => <div className="day-head" key={`${day}-${dayIndex}`}>
            {isEditingSchedule ? <><input value={day} onChange={(event) => editDay(dayIndex, event.target.value)} /><button className="courseplan-danger compact" onClick={() => removeDay(dayIndex)}>删除日期</button></> : <b>{day}</b>}
          </div>)}
          {viewConfig.periods.map((period, periodIndex) => <Fragment key={`${period.label}-${periodIndex}-row`}>
            <div className="period-cell" key={`${period.label}-${periodIndex}-period`}>
              {isEditingSchedule ? <><input value={period.label} onChange={(event) => editPeriod(periodIndex, { label: event.target.value })} /><input value={period.time ?? ""} onChange={(event) => editPeriod(periodIndex, { time: event.target.value })} placeholder="时间" /><button className="courseplan-danger compact" onClick={() => removePeriod(periodIndex)}>删除节次</button></> : <><b>{period.label}</b><span>{period.time || "未填时间"}</span></>}
            </div>
            {viewConfig.days.map((_, dayIndex) => {
              const courseName = viewCourses[dayIndex]?.[periodIndex] ?? "";
              const trimmedCourse = courseName.trim();
              return <div className={`courseplan-cell ${dayIndex === todayIndex ? "today" : ""} ${trimmedCourse ? "has-course" : "is-empty"}`} style={trimmedCourse ? courseColorMap.get(trimmedCourse) : undefined} key={`${dayIndex}-${periodIndex}`}>
                {isEditingSchedule ? <input value={courseName} onChange={(event) => changeCourse(dayIndex, periodIndex, event.target.value)} placeholder="填写课程" /> : trimmedCourse ? <span className="courseplan-subject"><b>{trimmedCourse}</b></span> : <em>未安排</em>}
              </div>;
            })}
          </Fragment>)}
        </div>
      </div>
    </section>

    <section className="courseplan-grid">
      <section className="courseplan-panel">
        <header className="courseplan-section-head"><div><span>班级活动</span><h3>本周安排</h3></div>{isEditingEvents ? <div><button className="courseplan-primary" onClick={saveEvents}>保存</button><button onClick={cancelEventsEdit}>取消</button></div> : <button onClick={startEventsEdit}>编辑</button>}</header>
        {isEditingEvents && <div className="courseplan-compose event">
          <input type="date" value={newEvent.date} onChange={(event) => setNewEvent((draft) => ({ ...draft, date: event.target.value }))} />
          <select value={newEvent.type} onChange={(event) => setNewEvent((draft) => ({ ...draft, type: event.target.value as ScheduleEvent["type"] }))}>{eventTypes.map((item) => <option key={item}>{item}</option>)}</select>
          <input value={newEvent.title} onChange={(event) => setNewEvent((draft) => ({ ...draft, title: event.target.value }))} placeholder="活动标题" />
          <input value={newEvent.detail} onChange={(event) => setNewEvent((draft) => ({ ...draft, detail: event.target.value }))} placeholder="地点或准备事项" />
          <button onClick={addEvent}>添加</button>
        </div>}
        <div className="courseplan-list">
          {viewEvents.length ? viewEvents.map((item) => <article key={item.id}>
            {isEditingEvents ? <><input type="date" value={item.date} onChange={(event) => setDraftEvents((items) => items.map((row) => row.id === item.id ? { ...row, date: event.target.value } : row))} /><select value={item.type} onChange={(event) => setDraftEvents((items) => items.map((row) => row.id === item.id ? { ...row, type: event.target.value as ScheduleEvent["type"] } : row))}>{eventTypes.map((type) => <option key={type}>{type}</option>)}</select><input value={item.title} onChange={(event) => setDraftEvents((items) => items.map((row) => row.id === item.id ? { ...row, title: event.target.value } : row))} /><input value={item.detail} onChange={(event) => setDraftEvents((items) => items.map((row) => row.id === item.id ? { ...row, detail: event.target.value } : row))} /><button className="courseplan-danger compact" onClick={() => setDraftEvents((items) => items.filter((row) => row.id !== item.id))}>删除</button></> : <><time>{item.date}</time><span>{item.type}</span><b>{item.title}</b><p>{item.detail || "暂无说明"}</p></>}
          </article>) : <p>本周暂无班级活动。</p>}
        </div>
      </section>

      <section className="courseplan-panel">
        <header className="courseplan-section-head"><div><span>每日重点</span><h3>本周重点事项</h3></div>{isEditingFocuses ? <div><button className="courseplan-primary" onClick={saveFocuses}>保存</button><button onClick={cancelFocusesEdit}>取消</button></div> : <button onClick={startFocusesEdit}>编辑</button>}</header>
        {isEditingFocuses && <div className="courseplan-compose focus">
          <input type="date" value={newFocus.date} onChange={(event) => setNewFocus((draft) => ({ ...draft, date: event.target.value }))} />
          <input value={newFocus.focus} onChange={(event) => setNewFocus((draft) => ({ ...draft, focus: event.target.value }))} placeholder="重点主题" />
          <select value={newFocus.status} onChange={(event) => setNewFocus((draft) => ({ ...draft, status: event.target.value as DailyFocus["status"] }))}>{focusStatuses.map((item) => <option key={item}>{item}</option>)}</select>
          <input value={newFocus.todo} onChange={(event) => setNewFocus((draft) => ({ ...draft, todo: event.target.value }))} placeholder="具体事项" />
          <button onClick={addFocus}>添加</button>
        </div>}
        <div className="courseplan-list">
          {viewFocuses.length ? viewFocuses.map((item) => <article key={item.id}>
            {isEditingFocuses ? <><input type="date" value={item.date} onChange={(event) => setDraftFocuses((items) => items.map((row) => row.id === item.id ? { ...row, date: event.target.value } : row))} /><input value={item.focus} onChange={(event) => setDraftFocuses((items) => items.map((row) => row.id === item.id ? { ...row, focus: event.target.value } : row))} /><select value={item.status} onChange={(event) => setDraftFocuses((items) => items.map((row) => row.id === item.id ? { ...row, status: event.target.value as DailyFocus["status"] } : row))}>{focusStatuses.map((status) => <option key={status}>{status}</option>)}</select><input value={item.todo} onChange={(event) => setDraftFocuses((items) => items.map((row) => row.id === item.id ? { ...row, todo: event.target.value } : row))} /><button className="courseplan-danger compact" onClick={() => setDraftFocuses((items) => items.filter((row) => row.id !== item.id))}>删除</button></> : <><time>{item.date}</time><span>{item.status}</span><b>{item.focus}</b><p>{item.todo || "暂无事项"}</p></>}
          </article>) : <p>本周暂无每日重点。</p>}
        </div>
      </section>
    </section>
  </div>;
}

function getWeekDates(month: string, weekOfMonth: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(year, monthNumber - 1, 1 + (weekOfMonth - 1) * 7);
  const end = new Date(year, monthNumber - 1, Math.min(new Date(year, monthNumber, 0).getDate(), weekOfMonth * 7));
  return { startDate: formatDate(start), endDate: formatDate(end), label: `${year}年${monthNumber}月第${weekOfMonth}周` };
}

function getWeeksInMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return Math.ceil(new Date(year, monthNumber, 0).getDate() / 7);
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
