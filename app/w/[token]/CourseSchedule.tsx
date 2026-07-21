"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ClassroomData, DailyFocus, ScheduleConfig, ScheduleEvent, ScheduleWeek } from "@/lib/classroom";

function ToolHeading({ kicker, title, text, action }: { kicker: string; title: string; text: string; action?: ReactNode }) {
  return <div className="tool-heading"><div><span className="section-kicker">{kicker}</span><h2>{title}</h2><p>{text}</p></div>{action}</div>;
}

export function CourseSchedule({ data, update }: { data: ClassroomData; update: (fn: (d: ClassroomData) => ClassroomData) => void }) {
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
  const storedWeeks = data.scheduleWeeks ?? [];
  const initialMonth = storedWeeks[0]?.month ?? new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(() => initialMonth);
  const [calendarYear, setCalendarYear] = useState(() => Number(initialMonth.slice(0, 4)) || new Date().getFullYear());
  const [jumpMonth, setJumpMonth] = useState(() => initialMonth);
  const [selectedWeek, setSelectedWeek] = useState(() => storedWeeks[0]?.weekOfMonth ?? 1);
  const [isEditing, setIsEditing] = useState(false);
  const [draftConfig, setDraftConfig] = useState<ScheduleConfig>(defaultConfig);
  const [draftCourses, setDraftCourses] = useState<string[][]>([]);
  const [draftEvents, setDraftEvents] = useState<ScheduleEvent[]>([]);
  const [draftFocuses, setDraftFocuses] = useState<DailyFocus[]>([]);
  const [newEvent, setNewEvent] = useState({ date: `${selectedMonth}-01`, title: "新班会/活动", type: "班会" as ScheduleEvent["type"], detail: "填写准备事项、地点、参与人和注意点。" });
  const [newFocus, setNewFocus] = useState({ date: `${selectedMonth}-01`, focus: "本日重点", todo: "写清今天必须处理的一件事。", status: "待处理" as DailyFocus["status"] });
  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, index) => `${calendarYear}-${String(index + 1).padStart(2, "0")}`), [calendarYear]);
  const selectedKey = `${selectedMonth}-w${selectedWeek}`;
  const currentWeek = storedWeeks.find((item) => item.month === selectedMonth && item.weekOfMonth === selectedWeek);
  const weekDates = getWeekDates(selectedMonth, selectedWeek);
  const viewConfig = isEditing ? draftConfig : currentWeek?.config ?? data.scheduleConfig ?? defaultConfig;
  const viewCourses = isEditing ? draftCourses : normalizeCourses(currentWeek?.courses ?? data.courses ?? [], viewConfig);
  const viewEvents = isEditing ? draftEvents : currentWeek?.events ?? (data.scheduleEvents ?? []).filter((item) => item.date >= weekDates.startDate && item.date <= weekDates.endDate);
  const viewFocuses = isEditing ? draftFocuses : currentWeek?.focuses ?? (data.dailyFocus ?? []).filter((item) => item.date >= weekDates.startDate && item.date <= weekDates.endDate);
  const monthWeeks = Array.from({ length: getWeeksInMonth(selectedMonth) }, (_, index) => {
    const week = index + 1;
    const stored = storedWeeks.find((item) => item.month === selectedMonth && item.weekOfMonth === week);
    const range = getWeekDates(selectedMonth, week);
    return { week, stored, ...range };
  });
  const todayIndex = Math.max(0, Math.min(viewConfig.days.length - 1, new Date().getDay() - 1));
  const todayCourses = viewCourses[todayIndex] ?? [];
  const filledCells = viewCourses.flat().filter((item) => item.trim()).length;
  const hasScheduleData = storedWeeks.length > 0 || filledCells > 0 || viewEvents.length > 0 || viewFocuses.length > 0;
  const firstColumnWidth = isEditing ? 270 : 150;
  const dayColumnWidth = isEditing ? 150 : 130;
  const scheduleMinWidth = firstColumnWidth + viewConfig.days.length * dayColumnWidth;
  const topSubjects = Object.entries(viewCourses.flat().filter(Boolean).reduce((result, subject) => {
    result[subject] = (result[subject] ?? 0) + 1;
    return result;
  }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1]).slice(0, 4);

  useEffect(() => {
    const baseConfig = currentWeek?.config ?? data.scheduleConfig ?? defaultConfig;
    setDraftConfig(baseConfig);
    setDraftCourses(normalizeCourses(currentWeek?.courses ?? data.courses ?? [], baseConfig));
    setDraftEvents(currentWeek?.events ?? (data.scheduleEvents ?? []).filter((item) => item.date >= weekDates.startDate && item.date <= weekDates.endDate));
    setDraftFocuses(currentWeek?.focuses ?? (data.dailyFocus ?? []).filter((item) => item.date >= weekDates.startDate && item.date <= weekDates.endDate));
    setNewEvent((draft) => ({ ...draft, date: weekDates.startDate }));
    setNewFocus((draft) => ({ ...draft, date: weekDates.startDate }));
    setIsEditing(false);
  }, [selectedKey]);

  function chooseMonth(month: string) {
    setSelectedMonth(month);
    setSelectedWeek(1);
    setCalendarYear(Number(month.slice(0, 4)) || calendarYear);
    setJumpMonth(month);
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
  function normalizeCourses(courses: string[][], nextConfig = viewConfig) {
    return nextConfig.days.map((_, dayIndex) => Array.from({ length: nextConfig.periods.length }, (__, period) => courses[dayIndex]?.[period] ?? ""));
  }
  function changeDraftConfig(patch: Partial<ScheduleConfig>) {
    setDraftConfig((current) => {
      const nextConfig = { ...current, ...patch };
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
  function applyPrimaryTemplate() {
    const nextConfig: ScheduleConfig = { ...draftConfig, days: ["周一", "周二", "周三", "周四", "周五"], periods: [
      { label: "早读", time: "08:00-08:20" }, { label: "第1节", time: "08:30-09:10" }, { label: "第2节", time: "09:20-10:00" }, { label: "第3节", time: "10:20-11:00" },
      { label: "第4节", time: "11:10-11:50" }, { label: "午间", time: "12:00-13:30" }, { label: "第5节", time: "14:00-14:40" }, { label: "延时", time: "16:20-17:30" },
    ] };
    setDraftConfig(nextConfig);
    setDraftCourses([
      ["语文", "数学", "英语", "体育", "午餐/午休", "阅读", "班会", "延时服务"],
      ["数学", "语文", "科学", "音乐", "午餐/午休", "劳动", "写字", "社团"],
      ["英语", "数学", "语文", "美术", "午餐/午休", "信息", "心理", "延时作业"],
      ["语文", "体育", "数学", "科学", "午餐/午休", "阅读", "综合", "延时服务"],
      ["数学", "语文", "英语", "劳动", "午餐/午休", "班会", "社团", "放学整理"],
    ]);
  }
  function addMiddleSchoolTemplate() {
    const nextConfig: ScheduleConfig = { ...draftConfig, days: ["周一", "周二", "周三", "周四", "周五", "周六"], periods: [
      { label: "早读", time: "07:30-07:55" }, { label: "第1节", time: "08:05-08:45" }, { label: "第2节", time: "08:55-09:35" }, { label: "第3节", time: "09:55-10:35" },
      { label: "第4节", time: "10:45-11:25" }, { label: "午休", time: "12:20-13:50" }, { label: "第5节", time: "14:10-14:50" }, { label: "第6节", time: "15:00-15:40" },
      { label: "第7节", time: "15:55-16:35" }, { label: "晚自习", time: "18:30-20:30" },
    ] };
    setDraftConfig(nextConfig);
    setDraftCourses((courses) => normalizeCourses(courses, nextConfig));
  }
  function clearSchedule() {
    setDraftCourses(draftConfig.days.map(() => Array.from({ length: draftConfig.periods.length }, () => "")));
  }
  function addEvent() {
    setDraftEvents((items) => [{ id: crypto.randomUUID(), ...newEvent }, ...items]);
  }
  function addFocus() {
    setDraftFocuses((items) => [{ id: crypto.randomUUID(), ...newFocus }, ...items]);
  }
  function saveWeek() {
    const range = getWeekDates(selectedMonth, selectedWeek);
    const week: ScheduleWeek = { id: currentWeek?.id ?? `sw-${selectedMonth}-w${selectedWeek}`, month: selectedMonth, weekOfMonth: selectedWeek, label: range.label, startDate: range.startDate, endDate: range.endDate, config: draftConfig, courses: normalizeCourses(draftCourses, draftConfig), events: draftEvents, focuses: draftFocuses };
    update((current) => {
      const nextWeeks = [week, ...(current.scheduleWeeks ?? []).filter((item) => !(item.month === selectedMonth && item.weekOfMonth === selectedWeek))].sort((a, b) => a.startDate.localeCompare(b.startDate));
      return { ...current, scheduleWeeks: nextWeeks, scheduleConfig: draftConfig, courses: week.courses, scheduleEvents: nextWeeks.flatMap((item) => item.events), dailyFocus: nextWeeks.flatMap((item) => item.focuses) };
    });
    setIsEditing(false);
  }

  return <>
    <ToolHeading kicker="课程与日程" title="长期查看和编辑每月每周课表" text="日历只负责定位年月周；学期范围、开学时间和学校说明都由老师自己填写，适合全国不同地区使用。" />
    {!hasScheduleData && <section className="schedule-empty-guide"><div><span>首次使用引导</span><h3>先选择月份和周次，再保存该周课表</h3><p>每一周都能拥有自己的课表和日程。调课周、考试周、补课周都可以单独保存。</p></div><ol><li>切换年份或跳转任意月份。</li><li>选择该月第几周，点击“编辑本周”。</li><li>保存后形成可回看的历史课表。</li></ol></section>}
    <section className="schedule-workbench">
      <div className="schedule-main-card">
        <div className="schedule-card-head"><div><span>{isEditing ? "正在编辑本周" : "本周课表"}</span><h3>{weekDates.label}课表</h3><p>{isEditing ? "可修改学期档案、星期、节次、时间和课程；模板不会覆盖老师填写的学期信息。" : "查看态保持干净，需要调整时再进入编辑。"}</p></div><div className="schedule-actions">{isEditing ? <><button onClick={saveWeek}>保存本周</button><button className="soft" onClick={() => setIsEditing(false)}>取消编辑</button></> : <><button onClick={() => setIsEditing(true)}>编辑本周</button><button className="soft" onClick={() => window.print()}>打印</button></>}</div></div>
        <div className="schedule-calendar-picker">
          <div className="calendar-year-toolbar"><button className="calendar-nav-btn" onClick={() => setCalendarYear((year) => year - 1)}>上一年</button><div className="calendar-year-title"><span>长期日历档案</span><b>{calendarYear}年</b><small>同一个链接持续使用；日历不规定开学和放假时间。</small></div><label className="calendar-jump">跳转月份<input type="month" value={jumpMonth} onChange={(event) => { const month = event.target.value; setJumpMonth(month); if (month) chooseMonth(month); }} /></label><button className="calendar-nav-btn" onClick={() => setCalendarYear((year) => year + 1)}>下一年</button></div>
          <div className="calendar-picker-head">{isEditing ? <><label>档案名称<input value={draftConfig.schoolYear} onChange={(event) => changeDraftConfig({ schoolYear: event.target.value })} placeholder="如：2026秋季接班档案" /></label><label>学期名称<input value={draftConfig.term} onChange={(event) => changeDraftConfig({ term: event.target.value })} placeholder="如：春季学期" /></label><label>起始月份<input type="month" value={draftConfig.termStartMonth ?? ""} onChange={(event) => changeDraftConfig({ termStartMonth: event.target.value })} /></label><label>结束月份<input type="month" value={draftConfig.termEndMonth ?? ""} onChange={(event) => changeDraftConfig({ termEndMonth: event.target.value })} /></label><label className="term-note-field">学期说明<input value={draftConfig.termNote ?? ""} onChange={(event) => changeDraftConfig({ termNote: event.target.value })} placeholder="如：本校9月3日报到，考试周另设课表" /></label></> : <><div><span>档案名称</span><b>{viewConfig.schoolYear}</b></div><div><span>学期名称</span><b>{viewConfig.term}</b></div><div><span>学期范围</span><b>{viewConfig.termStartMonth || viewConfig.termEndMonth ? `${viewConfig.termStartMonth || "未填"} 至 ${viewConfig.termEndMonth || "未填"}` : "由老师设置"}</b></div><div><span>学期说明</span><b>{viewConfig.termNote || "未填写"}</b></div></>}<div><span>正在查看</span><b>{selectedMonth} 第{selectedWeek}周</b></div><div><span>日期范围</span><b>{weekDates.startDate} 至 {weekDates.endDate}</b></div></div>
          <div className="school-year-calendar">{monthOptions.map((month) => <button className={month === selectedMonth ? "active" : ""} key={month} onClick={() => chooseMonth(month)}><b>{month.slice(5)}月</b><span>{storedWeeks.filter((item) => item.month === month).length ? `${storedWeeks.filter((item) => item.month === month).length}周已存` : "未建档"}</span></button>)}</div>
          <div className="calendar-week-row">{monthWeeks.map((item) => <button className={item.week === selectedWeek ? "active" : ""} key={item.week} onClick={() => setSelectedWeek(item.week)}><b>第{item.week}周</b><span>{item.startDate.slice(5)}—{item.endDate.slice(5)}</span><em>{item.stored ? "已保存" : "未编辑"}</em></button>)}</div>
        </div>
        <div className="schedule-inline-summary"><span>课程格 <b>{filledCells}</b></span><span>今日课务 <b>{todayCourses.filter(Boolean).length}</b></span><span>高频学科 <b>{topSubjects[0]?.[0] ?? "待填"}</b></span><span>本周日程 <b>{viewEvents.length + viewFocuses.length}</b></span></div>
        {isEditing && <div className="schedule-actions schedule-template-actions"><button onClick={applyPrimaryTemplate}>小学作息模板</button><button onClick={addMiddleSchoolTemplate}>含晚自习模板</button><button className="soft" onClick={clearSchedule}>清空课程</button></div>}
        {isEditing && <div className="course-palette">{["语文", "数学", "英语", "科学", "体育", "音乐", "美术", "劳动", "阅读", "班会", "午餐", "午睡", "晚自习", "社团"].map((subject) => <button key={subject} type="button">{subject}</button>)}</div>}
        <div className="schedule-scroll"><div className="schedule-grid rich-schedule-grid" style={{ gridTemplateColumns: `${firstColumnWidth}px repeat(${viewConfig.days.length}, minmax(${dayColumnWidth}px, 1fr))`, minWidth: `${scheduleMinWidth}px` }}><div className="schedule-corner">节次 / 星期</div>{viewConfig.days.map((d, dayIndex) => <b className={dayIndex === todayIndex ? "today-col editable-day-head" : "editable-day-head"} key={`${d}-${dayIndex}`}>{isEditing ? <><input value={d} onChange={(event) => editDay(dayIndex, event.target.value)} /><button className="mini-remove" onClick={() => removeDay(dayIndex)}>移除</button></> : <span>{d}</span>}</b>)}{viewConfig.periods.map((period, periodIndex) => <div className="schedule-row" key={`${period.label}-${periodIndex}`}><span className="period-editor">{isEditing ? <><input className="period-label-input" value={period.label} onChange={(event) => editPeriod(periodIndex, { label: event.target.value })} /><input className="period-time-input" value={period.time ?? ""} onChange={(event) => editPeriod(periodIndex, { time: event.target.value })} placeholder="时间" /><button className="mini-remove" onClick={() => removePeriod(periodIndex)}>移除</button></> : <><b>{period.label}</b><small>{period.time || "未填时间"}</small></>}</span>{viewConfig.days.map((_, day) => <div className={`editable-cell ${day === todayIndex ? "today-cell" : ""}`} key={day}>{isEditing ? <input value={viewCourses[day]?.[periodIndex] ?? ""} onChange={(event) => changeCourse(day, periodIndex, event.target.value)} placeholder="课程/午休/晚自习" /> : <b>{viewCourses[day]?.[periodIndex] || "—"}</b>}</div>)}</div>)}</div></div>
        {isEditing && <div className="schedule-structure-actions"><button onClick={addDay}>新增星期/上课日</button><button onClick={addPeriod}>新增节次/时间段</button></div>}
      </div>
      <aside className="today-brief"><div className="today-brief-head"><span>本周快速看</span><b>第{selectedWeek}周</b></div>{todayCourses.filter(Boolean).length ? todayCourses.map((course, index) => course && <div className="today-course" key={`${course}-${index}`}><i>{viewConfig.periods[index]?.label ?? `第${index + 1}节`}</i><span><b>{course}</b><small>{viewConfig.periods[index]?.time || "未填时间"}</small></span></div>) : <p className="empty-schedule">这一周还没有填写今日对应课程。</p>}<div className="today-plan-note"><span>本周日程摘要</span><b>{viewEvents[0]?.title || "暂无班会活动"}</b><small>{viewFocuses[0]?.todo || "暂无每日重点"}</small></div><div className="subject-cloud"><b>本周学科分布</b>{topSubjects.map(([subject, count]) => <span key={subject}>{subject}<em>{count}</em></span>)}</div></aside>
    </section>
    <section className="schedule-arrangements"><div className="schedule-card-head compact"><div><span>本周班会活动</span><h3>跟随周课表切换的日程</h3><p>查看态只展示本周安排；编辑态才显示新增、删除和输入框。</p></div></div>{isEditing && <div className="event-compose"><input type="date" value={newEvent.date} onChange={(event) => setNewEvent((draft) => ({ ...draft, date: event.target.value }))} /><select value={newEvent.type} onChange={(event) => setNewEvent((draft) => ({ ...draft, type: event.target.value as ScheduleEvent["type"] }))}>{["班会", "活动", "考试", "放假", "家校", "其他"].map((item) => <option key={item}>{item}</option>)}</select><input value={newEvent.title} onChange={(event) => setNewEvent((draft) => ({ ...draft, title: event.target.value }))} placeholder="活动标题" /><textarea value={newEvent.detail} onChange={(event) => setNewEvent((draft) => ({ ...draft, detail: event.target.value }))} /><button onClick={addEvent}>新增到月日程</button></div>}<div className="event-ledger">{viewEvents.length ? viewEvents.map((item) => <article className={!isEditing ? "read-only-row" : ""} key={item.id}>{isEditing ? <><input type="date" value={item.date} onChange={(event) => setDraftEvents((items) => items.map((row) => row.id === item.id ? { ...row, date: event.target.value } : row))} /><select value={item.type} onChange={(event) => setDraftEvents((items) => items.map((row) => row.id === item.id ? { ...row, type: event.target.value as ScheduleEvent["type"] } : row))}>{["班会", "活动", "考试", "放假", "家校", "其他"].map((type) => <option key={type}>{type}</option>)}</select><input value={item.title} onChange={(event) => setDraftEvents((items) => items.map((row) => row.id === item.id ? { ...row, title: event.target.value } : row))} /><textarea value={item.detail} onChange={(event) => setDraftEvents((items) => items.map((row) => row.id === item.id ? { ...row, detail: event.target.value } : row))} /><button onClick={() => setDraftEvents((items) => items.filter((row) => row.id !== item.id))}>删除</button></> : <><time>{item.date}</time><span>{item.type}</span><b>{item.title}</b><p>{item.detail}</p></>}</article>) : <p className="empty-schedule">本周暂无班会活动。点击“编辑本周”后可以添加。</p>}</div></section>
    <section className="week-plan-editor"><div className="schedule-card-head compact"><div><span>本周每日重点</span><h3>跟随周次保存的重点事项</h3><p>每一周有自己的重点清单，可以回看上周做了什么，也能提前规划下个月某周。</p></div></div>{isEditing && <div className="focus-compose"><input type="date" value={newFocus.date} onChange={(event) => setNewFocus((draft) => ({ ...draft, date: event.target.value }))} /><input value={newFocus.focus} onChange={(event) => setNewFocus((draft) => ({ ...draft, focus: event.target.value }))} placeholder="重点主题" /><select value={newFocus.status} onChange={(event) => setNewFocus((draft) => ({ ...draft, status: event.target.value as DailyFocus["status"] }))}>{["待处理", "进行中", "已完成"].map((item) => <option key={item}>{item}</option>)}</select><textarea value={newFocus.todo} onChange={(event) => setNewFocus((draft) => ({ ...draft, todo: event.target.value }))} /><button onClick={addFocus}>新增重点</button></div>}<div className="focus-board">{viewFocuses.length ? viewFocuses.map((item) => <article className={`${item.status} ${!isEditing ? "read-only-row" : ""}`} key={item.id}>{isEditing ? <><input type="date" value={item.date} onChange={(event) => setDraftFocuses((items) => items.map((row) => row.id === item.id ? { ...row, date: event.target.value } : row))} /><input value={item.focus} onChange={(event) => setDraftFocuses((items) => items.map((row) => row.id === item.id ? { ...row, focus: event.target.value } : row))} /><select value={item.status} onChange={(event) => setDraftFocuses((items) => items.map((row) => row.id === item.id ? { ...row, status: event.target.value as DailyFocus["status"] } : row))}>{["待处理", "进行中", "已完成"].map((status) => <option key={status}>{status}</option>)}</select><textarea value={item.todo} onChange={(event) => setDraftFocuses((items) => items.map((row) => row.id === item.id ? { ...row, todo: event.target.value } : row))} /><button onClick={() => setDraftFocuses((items) => items.filter((row) => row.id !== item.id))}>删除</button></> : <><time>{item.date}</time><b>{item.focus}</b><span>{item.status}</span><p>{item.todo}</p></>}</article>) : <p className="empty-schedule">本周暂无每日重点。点击“编辑本周”后可以添加。</p>}</div></section>
  </>;
}
