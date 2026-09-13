"use client";

import type { ClassroomData, Student } from "@/lib/classroom";
import { MetricStrip, ThemeArtwork } from "@/app/components/campus/primitives";
import { ThemeBoundary } from "@/app/components/workbench/theme/ThemeBoundary";
import { Button } from "@/app/components/workbench/ui/Button";
import { Dialog } from "@/app/components/workbench/ui/Dialog";
import { DraftClosePrompt } from "@/app/components/workbench/ui/DraftClosePrompt";
import { Drawer } from "@/app/components/workbench/ui/Drawer";
import { EmptyState } from "@/app/components/workbench/ui/FeedbackState";
import {
  Field,
  Input,
  Select,
  Textarea,
} from "@/app/components/workbench/ui/Field";
import { Menu, MenuItem } from "@/app/components/workbench/ui/Menu";
import { SelectionBar } from "@/app/components/workbench/ui/SelectionBar";
import { StatusSegment } from "@/app/components/workbench/ui/StatusSegment";
import { WorkbenchPageHeader } from "../../WorkbenchPageHeader";
import {
  homeworkStatus,
  summarizeHomeworkTask,
  type HomeworkStatus,
} from "./read-model";
import { useHomeworkController } from "./useHomeworkController";
import styles from "./HomeworkView.module.css";

type Update = (fn: (data: ClassroomData) => ClassroomData) => void;
type Confirm = (
  message: string,
  title?: string,
  confirmLabel?: string,
) => Promise<boolean>;
type Controller = ReturnType<typeof useHomeworkController>;
const statusOptions = [
  { value: "已交", label: "已交" },
  { value: "未交", label: "未交" },
  { value: "待订正", label: "待订正" },
  { value: "已复查", label: "已复查" },
] satisfies { value: HomeworkStatus; label: string }[];

function TaskList({ c, mobile }: { c: Controller; mobile: boolean }) {
  return (
    <div className={styles.taskList} aria-label="作业任务列表">
      {c.taskPageItems.map((task) => {
        const summary = summarizeHomeworkTask(task, c.students);
        return (
          <button
            type="button"
            key={task.id}
            data-current={task.id === c.selectedTask?.id}
            onClick={() => c.chooseTask(task.id, mobile)}
          >
            <span>
              <strong>{task.subject}</strong>
              <time>{task.date}</time>
            </span>
            <b>{task.title}</b>
            <small>
              {summary.pending ? `${summary.pending} 人待处理` : "本项已闭环"} ·
              完成 {summary.rate}%
            </small>
            <i aria-hidden="true">
              <span style={{ width: `${summary.rate}%` }} />
            </i>
          </button>
        );
      })}
      {!c.taskPageItems.length && (
        <EmptyState
          title={c.tasks.length ? "没有匹配的作业" : "还没有作业任务"}
          description={
            c.tasks.length
              ? "清除部分筛选条件后再查看。"
              : "新增作业后，逐生记录提交、订正和复查状态。"
          }
          action={
            !c.readOnly && !c.tasks.length ? (
              <Button intent="primary" onClick={c.openNewTask}>
                新增第一项作业
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}

function TaskFilters({ c, mobile }: { c: Controller; mobile: boolean }) {
  return (
    <>
      <div className={styles.taskFilters}>
        <Field id={`${mobile ? "mobile-" : ""}homework-query`} label="搜索作业">
          <Input
            id={`${mobile ? "mobile-" : ""}homework-query`}
            value={c.taskFilters.query}
            onChange={(event) =>
              c.patchTaskFilters({ query: event.target.value })
            }
            placeholder="学科、日期或作业内容"
          />
        </Field>
        <Field id={`${mobile ? "mobile-" : ""}homework-subject`} label="学科">
          <Select
            id={`${mobile ? "mobile-" : ""}homework-subject`}
            value={c.taskFilters.subject}
            onChange={(event) =>
              c.patchTaskFilters({ subject: event.target.value })
            }
          >
            <option>全部学科</option>
            {c.subjects.map((subject) => (
              <option key={subject}>{subject}</option>
            ))}
          </Select>
        </Field>
        <Button
          aria-expanded={c.advancedOpen}
          onClick={() => c.setAdvancedOpen(true)}
        >
          高级筛选
        </Button>
      </div>
      <div className={styles.taskResult}>
        <span>找到 {c.filteredTasks.length} 项</span>
        {Object.values(c.taskFilters).some(
          (value) =>
            value &&
            !["全部学科", "全部月份", "全部", "全部小组"].includes(value),
        ) && (
          <Button intent="text" onClick={c.resetTaskFilters}>
            清除筛选
          </Button>
        )}
      </div>
    </>
  );
}

function Pager({
  page,
  total,
  onPage,
  label,
}: {
  page: number;
  total: number;
  onPage: (page: number) => void;
  label: string;
}) {
  return (
    <nav className={styles.pager} aria-label={label}>
      <Button disabled={page <= 1} onClick={() => onPage(page - 1)}>
        上一页
      </Button>
      <span>
        {page} / {total}
      </span>
      <Button disabled={page >= total} onClick={() => onPage(page + 1)}>
        下一页
      </Button>
    </nav>
  );
}

function StudentRow({
  c,
  student,
  mobile,
}: {
  c: Controller;
  student: Student;
  mobile: boolean;
}) {
  if (!c.selectedTask) return null;
  const status = homeworkStatus(c.selectedTask, student);
  const selected = c.selectedStudentIds.includes(student.id);
  return (
    <article className={styles.studentRow} data-selected={selected}>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => c.toggleStudent(student.id)}
        />
        <span className="sr-only">选择{student.name}</span>
      </label>
      <div className={styles.studentIdentity}>
        <b>{student.name}</b>
        <small>
          学号 {student.studentNo || "未填"} · 第{student.group}组
        </small>
      </div>
      {!mobile && (
        <span className={styles.currentStatus} data-status={status}>
          {status}
        </span>
      )}
      <StatusSegment
        label={`${student.name}作业状态`}
        options={statusOptions}
        value={status}
        disabled={c.readOnly}
        onChange={(next) => c.setStudentStatus(student.id, next)}
      />
      <Field
        id={`${mobile ? "mobile-" : ""}homework-note-${student.id}`}
        label={mobile ? "班务备注" : "备注"}
      >
        <Input
          id={`${mobile ? "mobile-" : ""}homework-note-${student.id}`}
          value={student.note ?? ""}
          disabled={c.readOnly}
          onChange={(event) => c.setStudentNote(student.id, event.target.value)}
          placeholder="补充需持续关注的信息"
        />
      </Field>
    </article>
  );
}

function StudentWorkspace({ c, mobile }: { c: Controller; mobile: boolean }) {
  if (!c.selectedTask || !c.taskSummary)
    return (
      <div className={styles.noSelection}>
        <ThemeArtwork slot="homework" />
        <h3>选择一项作业</h3>
        <p>从任务列表进入后，可查看逐生状态与待跟进名单。</p>
      </div>
    );
  const task = c.selectedTask;
  return (
    <div className={styles.detailInner}>
      <header className={styles.taskContext}>
        <div>
          <span>{task.subject}</span>
          <h2>{task.title}</h2>
          <p>
            {task.date} · {c.students.length} 名学生
          </p>
        </div>
        {!mobile && <ThemeArtwork slot="homework" />}
        <Menu label="任务操作" align="end">
          <MenuItem disabled={c.readOnly} onSelect={c.openEditTask}>
            编辑作业
          </MenuItem>
          <MenuItem onSelect={() => c.setFollowOpen(true)}>
            待跟进名单（{c.followStudents.length}）
          </MenuItem>
          <MenuItem disabled={c.readOnly} onSelect={() => void c.deleteTask()}>
            删除作业
          </MenuItem>
        </Menu>
      </header>
      <dl className={styles.taskMetrics} aria-label="当前作业状态统计">
        <div>
          <dt>完成率</dt>
          <dd>{c.taskSummary.rate}%</dd>
        </div>
        {c.statusOptions.map((status) => (
          <div key={status}>
            <dt>{status}</dt>
            <dd>{c.taskSummary!.counts[status]}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.studentTools}>
        <Field
          id={`${mobile ? "mobile-" : ""}homework-student-query`}
          label="搜索学生"
        >
          <Input
            id={`${mobile ? "mobile-" : ""}homework-student-query`}
            value={c.studentFilters.query}
            onChange={(event) =>
              c.patchStudentFilters({ query: event.target.value })
            }
            placeholder="姓名、学号或备注"
          />
        </Field>
        <Field
          id={`${mobile ? "mobile-" : ""}homework-student-status`}
          label="状态"
        >
          <Select
            id={`${mobile ? "mobile-" : ""}homework-student-status`}
            value={c.studentFilters.status}
            onChange={(event) =>
              c.patchStudentFilters({
                status: event.target.value as "全部" | HomeworkStatus,
              })
            }
          >
            <option>全部</option>
            {c.statusOptions.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </Select>
        </Field>
        <Field
          id={`${mobile ? "mobile-" : ""}homework-student-group`}
          label="小组"
        >
          <Select
            id={`${mobile ? "mobile-" : ""}homework-student-group`}
            value={c.studentFilters.group}
            onChange={(event) =>
              c.patchStudentFilters({ group: event.target.value })
            }
          >
            <option>全部小组</option>
            {c.groups.map((group) => (
              <option key={group} value={group}>
                第{group}组
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <SelectionBar
        count={c.selectedStudentIds.length}
        scopeLabel={`当前筛选 ${c.filteredStudents.length} 人`}
        onClear={c.clearSelection}
        actions={
          <>
            <Button onClick={c.togglePage}>
              {c.allPageSelected ? "取消本页全选" : "全选本页"}
            </Button>
            <Menu label="批量改状态" disabled={c.readOnly}>
              {c.statusOptions.map((status) => (
                <MenuItem key={status} onSelect={() => c.bulkSet(status)}>
                  设为{status}
                </MenuItem>
              ))}
            </Menu>
            <Button disabled={c.readOnly} onClick={c.addSelectedToFollow}>
              加入待跟进
            </Button>
          </>
        }
      />
      {c.message && (
        <button
          type="button"
          className={styles.message}
          onClick={() => c.setMessage("")}
          aria-label="关闭提示"
        >
          <span>{c.message}</span>
          <b>关闭</b>
        </button>
      )}
      <div className={styles.studentList}>
        <div className={styles.studentHead}>
          <label>
            <input
              type="checkbox"
              aria-label="全选本页学生"
              checked={c.allPageSelected}
              onChange={c.togglePage}
            />
            <span>学生</span>
          </label>
          <span>当前状态</span>
          <span>快速处理</span>
          <span>完整备注</span>
        </div>
        {c.studentPageItems.map((student) => (
          <StudentRow
            key={student.id}
            c={c}
            student={student}
            mobile={mobile}
          />
        ))}
        {!c.studentPageItems.length && (
          <EmptyState
            title="没有符合条件的学生"
            description="调整姓名、状态或小组条件后再查看。"
            artworkRole="empty.no-results"
          />
        )}
      </div>
      <div className={styles.detailFooter}>
        <span>
          显示 {c.studentPageItems.length} / {c.filteredStudents.length} 人
        </span>
        <Pager
          page={c.studentPage}
          total={c.studentTotalPages}
          onPage={c.setStudentPage}
          label="学生分页"
        />
      </div>
    </div>
  );
}

function Editor({ c }: { c: Controller }) {
  const dateError = c.editorError && !c.draft.date ? "请填写日期。" : undefined;
  const subjectError =
    c.editorError && !c.draft.subject.trim() ? "请填写学科。" : undefined;
  const titleError =
    c.editorError && !c.draft.title.trim() ? "请填写作业内容。" : undefined;
  return (
    <Dialog
      open={Boolean(c.editorMode)}
      title={c.editorMode === "edit" ? "编辑作业" : "新增作业"}
      description="日期、学科和作业内容完整填写后才加入当前班级台账。"
      size="wide"
      dirty={c.editorDirty}
      onRequestClose={() => c.closeEditor()}
      footer={
        <>
          <Button onClick={() => c.closeEditor()}>取消</Button>
          <Button intent="primary" disabled={c.readOnly} onClick={c.saveTask}>
            {c.editorMode === "edit" ? "保存修改" : "新增作业"}
          </Button>
        </>
      }
    >
      <div className={styles.editorGrid}>
        <Field
          id="homework-editor-date"
          label="日期"
          required
          error={dateError}
        >
          <Input
            id="homework-editor-date"
            type="date"
            autoFocus
            value={c.draft.date}
            error={dateError}
            onChange={(event) => {
              c.setDraft({ ...c.draft, date: event.target.value });
            }}
          />
        </Field>
        <Field
          id="homework-editor-subject"
          label="学科"
          required
          error={subjectError}
        >
          <Input
            id="homework-editor-subject"
            value={c.draft.subject}
            error={subjectError}
            onChange={(event) =>
              c.setDraft({ ...c.draft, subject: event.target.value })
            }
            placeholder="例如：语文"
          />
        </Field>
        <div className={styles.editorWide}>
          <Field
            id="homework-editor-title"
            label="作业内容"
            required
            error={titleError}
          >
            <Textarea
              id="homework-editor-title"
              rows={8}
              value={c.draft.title}
              error={titleError}
              onChange={(event) =>
                c.setDraft({ ...c.draft, title: event.target.value })
              }
              placeholder="填写页码、练习名称、订正要求等完整内容"
            />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}

function AdvancedFilters({ c }: { c: Controller }) {
  const reversed =
    c.taskFilters.dateFrom &&
    c.taskFilters.dateTo &&
    c.taskFilters.dateFrom > c.taskFilters.dateTo;
  return (
    <Drawer
      open={c.advancedOpen}
      title="高级筛选"
      description="按归档月份、日期、学生状态或小组缩小任务范围。"
      onRequestClose={() => c.setAdvancedOpen(false)}
      footer={
        <>
          <Button onClick={c.resetTaskFilters}>重置条件</Button>
          <Button intent="primary" onClick={() => c.setAdvancedOpen(false)}>
            查看结果
          </Button>
        </>
      }
    >
      <div className={styles.drawerFields}>
        <Field id="homework-filter-month" label="归档月份">
          <Select
            id="homework-filter-month"
            value={c.taskFilters.month}
            onChange={(event) =>
              c.patchTaskFilters({ month: event.target.value })
            }
          >
            <option>全部月份</option>
            {c.months.map((month) => (
              <option key={month}>{month}</option>
            ))}
          </Select>
        </Field>
        <Field id="homework-filter-status" label="包含学生状态">
          <Select
            id="homework-filter-status"
            value={c.taskFilters.status}
            onChange={(event) =>
              c.patchTaskFilters({
                status: event.target.value as "全部" | HomeworkStatus,
              })
            }
          >
            <option>全部</option>
            {c.statusOptions.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </Select>
        </Field>
        <Field id="homework-filter-student" label="查某个学生">
          <Input
            id="homework-filter-student"
            value={c.taskFilters.studentQuery}
            onChange={(event) =>
              c.patchTaskFilters({ studentQuery: event.target.value })
            }
            placeholder="姓名、学号或备注"
          />
        </Field>
        <Field id="homework-filter-group" label="学生小组">
          <Select
            id="homework-filter-group"
            value={c.taskFilters.group}
            onChange={(event) =>
              c.patchTaskFilters({ group: event.target.value })
            }
          >
            <option>全部小组</option>
            {c.groups.map((group) => (
              <option value={group} key={group}>
                第{group}组
              </option>
            ))}
          </Select>
        </Field>
        <Field id="homework-filter-from" label="开始日期">
          <Input
            id="homework-filter-from"
            type="date"
            value={c.taskFilters.dateFrom}
            onChange={(event) =>
              c.patchTaskFilters({ dateFrom: event.target.value })
            }
          />
        </Field>
        <Field id="homework-filter-to" label="结束日期">
          <Input
            id="homework-filter-to"
            type="date"
            value={c.taskFilters.dateTo}
            onChange={(event) =>
              c.patchTaskFilters({ dateTo: event.target.value })
            }
          />
        </Field>
        {reversed && (
          <p className={styles.filterHint}>
            开始与结束日期会自动按先后顺序匹配。
          </p>
        )}
      </div>
    </Drawer>
  );
}

function FollowList({ c }: { c: Controller }) {
  return (
    <Drawer
      open={c.followOpen}
      title="待跟进名单"
      description={
        c.selectedTask
          ? `${c.selectedTask.date} · ${c.selectedTask.subject} · ${c.selectedTask.title}`
          : undefined
      }
      onRequestClose={() => c.setFollowOpen(false)}
      footer={
        <>
          <Button onClick={() => c.setFollowOpen(false)}>关闭</Button>
          <Button
            intent="primary"
            disabled={!c.followStudents.length}
            onClick={() => void c.copyFollowList()}
          >
            复制名单
          </Button>
        </>
      }
    >
      <div className={styles.followList}>
        {c.followStudents.map((student, index) => (
          <article key={student.id}>
            <span>{index + 1}</span>
            <div>
              <b>{student.name}</b>
              <small>
                第{student.group}组 ·{" "}
                {c.selectedTask ? homeworkStatus(c.selectedTask, student) : ""}
              </small>
              {student.note && <p>{student.note}</p>}
            </div>
            <Button
              intent="text"
              disabled={c.readOnly}
              onClick={() => c.removeFollow(student.id)}
            >
              移出
            </Button>
          </article>
        ))}
        {!c.followStudents.length && (
          <EmptyState
            title="暂无待跟进学生"
            description="勾选学生后使用“加入待跟进”。"
          />
        )}
      </div>
      {c.message && (
        <p className={styles.followMessage} role="status">
          {c.message}
        </p>
      )}
    </Drawer>
  );
}

export function HomeworkView({
  data,
  update,
  confirmAction,
  mobile = false,
  readOnly = false,
}: {
  data: ClassroomData;
  update: Update;
  confirmAction: Confirm;
  mobile?: boolean;
  readOnly?: boolean;
}) {
  const c = useHomeworkController({ data, update, confirmAction, readOnly });
  return (
    <ThemeBoundary>
      <section
        className={`${styles.page} ${mobile ? styles.mobile : ""}`}
        aria-labelledby={mobile ? "mobile-homework-title" : undefined}
      >
        {mobile ? (
          <header className={styles.mobileHeader}>
            <div>
              <span>{c.activeClass.name}</span>
              <h2 id="mobile-homework-title">作业追踪</h2>
            </div>
            <Button
              intent="primary"
              disabled={readOnly}
              onClick={c.openNewTask}
            >
              新增作业
            </Button>
          </header>
        ) : (
          <WorkbenchPageHeader
            icon="homework"
            tone="coral"
            title="作业追踪"
            description={`${c.activeClass.name} · 从任务进入学生状态，集中完成提交、订正、复查和跟进。`}
            actions={
              <Button
                intent="primary"
                disabled={readOnly}
                onClick={c.openNewTask}
              >
                新增作业
              </Button>
            }
          />
        )}
        {readOnly && (
          <p className={styles.readOnly} role="status">
            当前为只读模式：可搜索、筛选、查看和复制，不能修改作业与学生状态。
          </p>
        )}
        {!mobile && (
          <MetricStrip
            items={[
              { label: "总任务", value: c.metrics.total, detail: "当前班级" },
              {
                label: "待处理任务",
                value: c.metrics.pending,
                detail: "含未交或待订正",
              },
              {
                label: "已记录完成率",
                value: `${c.metrics.rate}%`,
                detail: "已交与已复查人次",
              },
            ]}
          />
        )}
        <div className={styles.workspace}>
          <aside className={styles.master}>
            <TaskFilters c={c} mobile={mobile} />
            <TaskList c={c} mobile={mobile} />
            <Pager
              page={c.taskPage}
              total={c.taskTotalPages}
              onPage={c.setTaskPage}
              label="作业任务分页"
            />
          </aside>
          {!mobile && (
            <section className={styles.detail}>
              <StudentWorkspace c={c} mobile={false} />
            </section>
          )}
        </div>
        <Drawer
          open={mobile && c.mobileDetailOpen}
          title={
            c.selectedTask ? `${c.selectedTask.subject} · 作业处理` : "作业处理"
          }
          description="返回任务列表后，搜索与筛选条件会保留。"
          size="wide"
          onRequestClose={() => c.setMobileDetailOpen(false)}
        >
          <StudentWorkspace c={c} mobile />
        </Drawer>
        <Editor c={c} />
        <AdvancedFilters c={c} />
        <FollowList c={c} />
        <DraftClosePrompt
          open={c.discardOpen}
          title="放弃这次作业编辑？"
          description="尚未提交的日期、学科和作业内容不会保留。"
          onContinue={() => c.setDiscardOpen(false)}
          onDiscard={() => c.closeEditor(true)}
        />
      </section>
    </ThemeBoundary>
  );
}
