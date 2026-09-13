import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const app = read("app/w/[token]/ClassroomApp.tsx");
const workspaceOperations = read("app/w/[token]/workspace/operations.ts");
const workspaceController = read("app/w/[token]/workspace/useWorkspaceController.ts");
const dashboard = read("app/w/[token]/features/dashboard/DashboardView.tsx");
const dashboardCss = read("app/w/[token]/features/dashboard/DashboardView.module.css");
const dashboardReadModel = read("app/w/[token]/features/dashboard/read-model.ts");
const dialogBehavior = read("app/components/campus/DialogAccessibility.tsx");
const sharedDialog = read("app/components/workbench/ui/Dialog.tsx");
const modalLayer = read("app/components/workbench/ui/ModalLayer.tsx");
const clipboard = read("lib/clipboard.ts");
const workspaceRoute = read("app/api/workspace/[token]/route.ts");
const aiRoute = read("app/api/ai/comment/route.ts");
const auth = read("lib/auth.ts");
const home = read("app/page.tsx");
const entryPage = read("app/features/entry/EntryPage.tsx");
const entryController = read("app/features/entry/useEntryController.ts");
const entryStyles = read("app/features/entry/EntryPage.module.css");
const privacyPage = read("app/features/entry/PrivacyPage.tsx");
const adminStyles = read("app/admin/features/admin/AdminConsole.module.css");
const accountCenter = read("app/w/[token]/features/account/AccountCenter.tsx");
const accountController = read("app/w/[token]/features/account/useAccountCenter.ts");
const accountOperations = read("app/w/[token]/features/account/operations.ts");
const accountStyles = read("app/w/[token]/features/account/AccountCenter.module.css");
const adminPage = read("app/admin/page.tsx");
const adminConsole = read("app/admin/features/admin/AdminConsole.tsx");
const adminUserDialog = read("app/admin/features/admin/AdminUserDialog.tsx");
const adminController = read("app/admin/features/admin/useAdminConsole.ts");
const adminApiClient = read("app/admin/features/admin/api.ts");
const adminUi = adminPage + adminConsole + adminUserDialog + adminController + adminApiClient;
const redeemRoute = read("app/api/admin/redeem-codes/route.ts");
const adminUsersRoute = read("app/api/admin/users/route.ts");
const authMeRoute = read("app/api/auth/me/route.ts");
const workspaceSchema = read("db/workspaces.ts");
const userDataRoute = read("app/api/admin/users/[id]/data/route.ts");
const classroomTypes = read("lib/classroom.ts");
const attendancePage = read("app/w/[token]/Attendance.tsx");
const teacherAgenda = read("app/w/[token]/TeacherAgenda.tsx");
const scheduleHub = read("app/w/[token]/ScheduleHub.tsx");
const scheduleOperations = read("app/w/[token]/features/schedule/operations.ts");
const studentProfile = read("app/w/[token]/StudentProfile.tsx");
const studentProfileOperations = read("app/w/[token]/features/students/profile.ts");
const studentView = read("app/w/[token]/features/students/StudentsView.tsx");
const studentStyles = read("app/w/[token]/features/students/StudentsView.module.css");
const homeworkView = read("app/w/[token]/features/homework/HomeworkView.tsx");
const homeworkController = read("app/w/[token]/features/homework/useHomeworkController.ts");
const homeworkReadModel = read("app/w/[token]/features/homework/read-model.ts");
const homeworkStyles = read("app/w/[token]/features/homework/HomeworkView.module.css");
const scoreTrends = read("app/w/[token]/ScoreTrends.tsx");
const classroomTools = read("app/w/[token]/ClassroomTools.tsx");
const classroomToolsOperations = read("app/w/[token]/features/tools/operations.ts");
const notificationDrafts = read("app/w/[token]/NotificationDrafts.tsx");
const notificationOperations = read("app/w/[token]/features/notifications/operations.ts");
const scoreItemAnalysis = read("app/w/[token]/ScoreItemAnalysis.tsx");
const scoreOperations = read("app/w/[token]/features/scores/operations.ts");
const reflectionOperations = read("app/w/[token]/features/reflections/operations.ts");
const workspaceBackup = read("lib/workspaceBackup.ts");
const authSource = read("lib/auth.ts");
const examPaperRoute = read("app/api/ai/exam-paper/route.ts");
const healthCare = read("app/w/[token]/HealthCare.tsx");
const healthOperations = read("app/w/[token]/features/health/operations.ts");
const workbenchRepair = read("app/workbench-repair.css");
const workbenchShell = read("app/components/workbench/shell/WorkbenchShell.tsx");
const shellCatalog = read("app/components/workbench/shell/catalog.ts");
const shellController = read("app/components/workbench/shell/useWorkbenchShellController.ts");
const shellCss = read("app/components/workbench/shell/shell.module.css");
const dictationWorkspace = read("app/w/[token]/dictation/Dictation.tsx");
const familyScene = read("app/w/[token]/dictation/FamilyScene.tsx");
const pageFamiliesCss = read("app/components/campus/page-families.css");
const campusTheme = read("app/components/campus/theme.ts");
const themeDefinitions = read("app/components/workbench/theme/definitions.ts");
const rootLayout = read("app/layout.tsx");
const dutyPage = read("app/w/[token]/Duty.tsx");
const dutyOperations = read("app/w/[token]/features/duty/operations.ts");
const idWriteSurfaces = [attendancePage, teacherAgenda, classroomTools, notificationDrafts, studentProfile, read("app/w/[token]/CourseSchedule.tsx"), app];

test("public entry exposes only the two intended primary routes", () => {
  const publicEntry = home + entryPage;
  assert.match(publicEntry, /进入我的工作台/);
  assert.match(publicEntry, /查看只读演示/);
  assert.doesNotMatch(publicEntry, /功能总览|打开演示班级|查看模块/);
  assert.match(entryController, /\/api\/auth\/me/);
  assert.match(entryController, /\/api\/auth\/enter/);
  assert.match(entryController, /网络连接失败，请稍后重试/);
  assert.match(entryStyles, /max-height:\s*calc\(100dvh - 12px\)/);
  assert.doesNotMatch(adminStyles, /entry-|privacy-page/);
});

test("privacy migration preserves the established data and AI statements", () => {
  assert.match(privacyPage, /正式工作台按账户隔离。工作台地址只用于定位数据，仍需有效账户会话和已绑定浏览器才能访问。/);
  assert.match(privacyPage, /AI 编写仅在老师主动确认后启用，并只发送当前编辑所选择的资料。/);
  assert.match(privacyPage, /管理员应先向用户提供导出文件，再执行不可恢复删除。/);
  assert.match(privacyPage, /工作台到期后进入 30 天只读宽限期/);
});

test("account center unifies account, classes, backup and current-device logout", () => {
  assert.match(accountCenter, /账户与班级/);
  assert.match(accountCenter, /新建空白班级/);
  assert.match(accountCenter, /选择备份并预检/);
  assert.match(accountCenter, /退出当前设备/);
  assert.match(accountController, /\/api\/auth\/me/);
  assert.match(accountOperations, /removeWorkspaceClass/);
  assert.match(app, /\/api\/auth\/logout/);
  assert.match(accountStyles, /grid-template-columns:\s*250px minmax\(0, 1fr\)/);
  assert.doesNotMatch(workbenchRepair, /account-dialog|mobile-account-brief|sidebar-account-entry|sidebar-data-actions/);
});

test("formal workspace access is session-owned and demo is read-only", () => {
  assert.match(workspaceRoute, /requireWorkspaceOwner/);
  assert.match(workspaceRoute, /token === demoWorkspace\.token/);
  assert.match(workspaceRoute, /演示数据不能保存/);
  assert.match(auth, /owner_user_id = \?/);
});

test("formal workspaces start blank while demo remains the only seeded classroom", () => {
  assert.match(classroomTypes, /export function createEmptyClassroomData/);
  assert.match(authSource, /JSON\.stringify\(createEmptyClassroomData\(\)\)/);
  assert.doesNotMatch(authSource, /JSON\.stringify\(defaultClassroomData\)/);
});

test("health care is a standalone, privacy-bounded operational workspace", () => {
  assert.match(shellCatalog, /id: 'health', label: '健康与照护'/);
  assert.match(app, /<HealthCare data=\{workspace\.data\} update=\{updateData\}/);
  assert.match(app, /<HealthCare data=\{data\} update=\{update\} mobile/);
  assert.match(classroomTypes, /actionContexts/);
  assert.match(classroomTypes, /customCategory/);
  assert.match(healthCare, /隐私边界/);
  assert.match(healthCare, /输入姓名、学号或小组搜索/);
  assert.match(healthCare, /自定义关注类型/);
  assert.match(healthCare, /自定义场景/);
  assert.match(healthCare, /学生名单中的主要监护人/);
  assert.match(healthOperations, /visibleScope: '班主任'/);
  assert.doesNotMatch(healthCare, /行动提醒板|下次复核日期/);
  assert.match(workbenchRepair, /\.health-care-page \.primary-button\s*\{[^}]*color:\s*var\(--campus-surface\);[^}]*background:\s*var\(--campus-primary\);/);
});

test("authentication keeps HTTP as an explicit temporary switch", () => {
  assert.match(auth, /AUTH_ALLOW_INSECURE_HTTP === "true"/);
  assert.match(auth, /INSECURE_HTTP_DISABLED/);
  assert.match(auth, /HttpOnly; SameSite=Lax/);
  assert.match(auth, /AUTH_TRUST_PROXY_HEADERS === "true"/);
  assert.match(auth, /trustsProxyHeaders\(\) \? request\.headers\.get\("x-forwarded-proto"\)/);
});

test("administrator password accepts the chosen eight-character minimum", () => {
  assert.match(auth, /expected\.length >= 8/);
});

test("administrator can generate and review short redeem codes in bulk", () => {
  assert.match(auth, /createRedeemCode\(length = 8\)/);
  assert.match(auth, /Math\.min\(8, Math\.max\(6/);
  assert.match(auth, /encryptRedeemCode/);
  assert.match(redeemRoute, /Math\.min\(50, Math\.max\(1/);
  assert.match(redeemRoute, /code_encrypted/);
  assert.match(redeemRoute, /decryptRedeemCode/);
  assert.match(adminUi, /生成数量/);
  assert.match(adminUi, /复制全部/);
  assert.match(adminUi, /历史码（尾号/);
});

test("administrator views full account data while workspace account stays concise", () => {
  assert.match(adminUsersRoute, /phone: String\(row\.phone\)/);
  assert.match(adminUi, /user\.phone/);
  assert.match(adminUi, /code\.phone \|\| '未绑定'/);
  assert.match(authMeRoute, /phone: session\.phone/);
  assert.match(accountCenter, /account\?\.phone/);
  assert.match(accountCenter, /当前设备/);
  assert.doesNotMatch(accountCenter, /phoneMasked|兑换码明文|全部设备/);
  assert.match(accountCenter, /当前浏览器会解除绑定/);
  assert.match(accountCenter, /其他设备不受影响/);
});

test("automatic persistence stays quiet until a save fails", () => {
  assert.doesNotMatch(app, /已同步到工作台|修改会自动保存到当前工作台|立即同步|正在同步…/);
  assert.match(app, /useWorkspaceController\(\{/);
  assert.match(workspaceController, /createWorkspaceOperations\(\{/);
  assert.match(workspaceOperations, /修改已保存在本机，可点击重试/);
  assert.match(workbenchShell, /'重试'/);
  assert.match(workspaceController, /载入服务器最新版本/);
  assert.match(workbenchShell, /导出当前草稿/);
  assert.match(workspaceController, /beforeunload/);
  assert.match(workspaceController, /setTimeout\(\(\) => \{ void workspaceOperations\(\)\.save\(\); \}, 900\)/);
});

test("workspace saves use optimistic revisions and keep recoverable versions", () => {
  assert.match(workspaceRoute, /WORKSPACE_CONFLICT/);
  assert.match(workspaceRoute, /withDatabaseTransaction/);
  assert.match(workspaceRoute, /workspace_versions/);
  assert.match(workspaceSchema, /workspace_versions/);
  assert.match(workspaceRoute, /LIMIT 20/);
});

test("workspace backup restore validates file size, identities and structure before replacement", () => {
  assert.match(workspaceBackup, /MAX_WORKSPACE_BACKUP_BYTES/);
  assert.match(workspaceBackup, /重复或空白 ID/);
  assert.match(workspaceBackup, /班级列表/);
  assert.match(app, /parseWorkspaceBackup\(await file\.text\(\), file\.size\)/);
  assert.match(app, /预检通过：恢复完整备份/);
  assert.match(app, /确认替换并同步/);
});

test("administrator can export and permanently delete user data with confirmation", () => {
  assert.match(userDataRoute, /classroom-user-export/);
  assert.match(userDataRoute, /payload\.confirmation !== user\.phone/);
  assert.match(adminUi, /导出用户完整数据/);
  assert.match(adminUi, /永久删除账户与全部工作台数据/);
  assert.match(adminUi, /deleteConfirmation !== selectedUser\.phone/);
});

test("administrator uses the shared theme, native dialog and page-scoped styles", () => {
  assert.match(adminPage, /<AdminConsole/);
  assert.match(adminConsole, /<ThemeBoundary>/);
  assert.match(adminUserDialog, /<Dialog open/);
  assert.match(adminController, /Promise\.all/);
  assert.match(adminController, /setLoadError/);
  assert.match(adminStyles, /grid-template-columns:\s*245px minmax\(0, 1fr\)/);
  assert.match(adminStyles, /\.table thead/);
  assert.doesNotMatch(rootLayout, /admin\.css/);
  assert.doesNotMatch(adminStyles, /\.admin-(?:page|dialog|code-maker)/);
});

test("desktop shell has one page title and one account entry in the global header", () => {
  assert.doesNotMatch(app, /<header className="topbar">/);
  assert.match(workbenchShell, /账户与班级/);
  assert.match(workbenchShell, /<SaveStatus/);
  assert.doesNotMatch(workbenchShell, /sidebar-account-entry|恢复备份/);
});

test("campus rebuild owns one shared shell and four task-oriented navigation groups", () => {
  assert.match(app, /<WorkbenchShell/);
  assert.doesNotMatch(app, /<DesktopHeader|<WorkspaceNav|function MobileWorkbench/);
  assert.doesNotMatch(workbenchShell, /campus-workspace-shell|campus-desktop-header|campus-workspace-nav/);
  assert.match(shellCatalog, /title: '今日'/);
  assert.match(shellCatalog, /title: '学生'/);
  assert.match(shellCatalog, /title: '教学'/);
  assert.match(shellCatalog, /title: '班级'/);
  assert.match(shellCss, /grid-template-columns:\s*244px minmax\(0,\s*1fr\)/);
  assert.match(shellCss, /grid-template-rows:\s*72px minmax\(0,\s*1fr\)/);
  assert.match(workbenchShell, /手机底部导航/);
  assert.match(workbenchShell, /返回上一页/);
  assert.match(workbenchShell, /data-workbench-navigation/);
  assert.match(workbenchShell, /mobileMoreGroups\.map/);
  assert.doesNotMatch(dictationWorkspace, /aria-label="学习场景"/);
  assert.doesNotMatch(familyScene, /backToClass|onClass/);
  assert.match(app, /visitedMobileModules/);
  assert.match(workbenchShell, /scrollPositionsRef/);
  assert.match(workbenchShell, /<Drawer/);
  assert.match(shellController, /canLeave\(\)/);
  assert.match(shellController, /pushState/);
  assert.doesNotMatch(workbenchShell + shellController, /matchMedia/);
  assert.doesNotMatch(rootLayout, /legacy-theme\.css/);
});

test("benchmark pages use reference-led compositions and semantic artwork slots", () => {
  assert.match(dashboard, /className=\{styles\.stage\}/);
  assert.match(dashboardCss, /\.stage\{/);
  assert.match(app, /<StudentsView data=/);
  assert.match(studentView, /className=\{styles\.workspace\}/);
  assert.match(studentStyles, /grid-template-columns:minmax\(620px,1fr\) 350px/);
  assert.match(app, /<HomeworkView data=/);
  assert.match(homeworkView, /aria-label="作业任务列表"/);
  assert.match(homeworkStyles, /grid-template-columns:\s*330px minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(pageFamiliesCss, /campus-student-workspace|roster-data-table/);
  assert.match(campusTheme, /assessment: 'assessment\.context'/);
  assert.match(campusTheme, /planning: 'planning\.context'/);
  assert.match(themeDefinitions, /'assessment\.context': artwork\('\/art\/campus\/assessment-review\.webp'/);
  assert.match(themeDefinitions, /'planning\.context': artwork\('\/art\/campus\/class-planner\.webp'/);
  assert.match(themeDefinitions, /status: 'planned'/);
  assert.match(themeDefinitions, /artworkByRole: \{\}/);
  assert.doesNotMatch(app, /切换玻璃|玻璃主题/);
});

test("AI requires consent, quota and an owned workspace token", () => {
  assert.match(aiRoute, /AI_CONSENT_REQUIRED/);
  assert.match(aiRoute, /consumeAiUsage/);
  assert.match(aiRoute, /缺少当前工作台信息/);
  assert.match(aiRoute, /payload\.workspaceToken !== workspace\.access_token/);
});

test("mobile workflows preserve agreed interaction rules", () => {
  assert.match(homeworkController, /statuses: Object\.fromEntries\(students\.map\(student => \[student\.id, '已交'\]\)\)/);
  assert.match(homeworkView, /mobileDetailOpen/);
  assert.match(app, /selectedIds\.length > 0/);
  assert.match(app, /批量录分/);
  assert.match(app, /添加成长记录 · \$\{selectedGrowthStudent\.name\}/);
  assert.match(app, /周一/);
  assert.match(app, /周五/);
});

test("homework uses one controller for desktop and mobile task-first workflows", () => {
  assert.match(homeworkController, /function bulkSet\(status: HomeworkStatus\)[\s\S]*?setSelectedStudentIds\(\[\]\)/);
  assert.match(homeworkController, /function addSelectedToFollow\(\)[\s\S]*?setSelectedStudentIds\(\[\]\)[\s\S]*?setFollowOpen\(true\)/);
  assert.match(homeworkController, /copyFollowList/);
  assert.match(homeworkView, /title="待跟进名单"/);
  assert.match(homeworkView, /<SelectionBar/);
  assert.match(homeworkView, /open=\{mobile && c\.mobileDetailOpen\}/);
  assert.match(homeworkView, /<DraftClosePrompt/);
  assert.match(homeworkReadModel, /task\.classId === classId/);
  assert.doesNotMatch(app, /function Homework\(|function MobileHomework\(/);
  assert.doesNotMatch(homeworkView, /mobile-task-sheet-summary|点学生可多选/);
});

test("duty timetable follows the course schedule's custom teaching days", () => {
  assert.match(dutyPage, /data\.scheduleConfig\?\.days \?\? defaultDays/);
  assert.match(dutyPage, /days\.map\(day =>/);
  assert.match(dutyPage, /gridTemplateColumns: `170px repeat\(\$\{days\.length\}/);
  assert.match(dutyOperations, /export function dutyDateForDay/);
  assert.match(dutyOperations, /export function sameDutyDay/);
  assert.match(app, /pane\('duty', <Duty data=\{data\} update=\{update\} readOnly=\{isDemo \|\| isReadOnly\} mobile/);
  assert.doesNotMatch(app, /className="duty3-page"|className="mobile-stack mobile-duty-page"/);
});

test("attendance keeps all actions in the batch-capable main roster", () => {
  assert.match(classroomTypes, /export type AttendanceRecord/);
  assert.match(classroomTypes, /attendanceRecords\?: AttendanceRecord\[\]/);
  assert.match(shellCatalog, /id: 'attendance', label: '考勤与请假'/);
  assert.match(app, /active === "attendance"/);
  assert.match(attendancePage, /一键全员正常/);
  assert.match(attendancePage, /月度记录/);
  assert.match(attendancePage, /无记录不等于全员正常/);
  assert.match(attendancePage, /className="attendance-roster-controls"/);
  assert.match(attendancePage, /className="attendance-batch-bar"/);
  assert.match(attendancePage, /function applyBatch\(\)[\s\S]*?setSelectedIds\(\[\]\)/);
  assert.match(attendancePage, /function setStudentStatus\([\s\S]*?setSelectedIds\(\[\]\)/);
  assert.doesNotMatch(attendancePage, /补充请假信息|请假至|请假原因|attendance-leave-details/);
  assert.doesNotMatch(attendancePage, /attendance-mobile-editor-backdrop/);
});

test("client write flows keep working when randomUUID is unavailable on HTTP", () => {
  assert.match(classroomTypes, /export function makeId\(prefix = "id"\)/);
  assert.match(classroomTypes, /typeof globalThis\.crypto\?\.randomUUID === "function"/);
  assert.match(classroomTypes, /Math\.random\(\)\.toString\(36\)/);
  for (const source of idWriteSurfaces) assert.doesNotMatch(source, /crypto\.randomUUID\(/);
  assert.match(attendancePage, /makeId\("attendance"\)/);
});

test("course scheduling keeps teacher work in the same module with traceable records", () => {
  assert.match(classroomTypes, /export type TeacherAgendaItem/);
  assert.match(classroomTypes, /export type WorkLog/);
  assert.match(classroomTypes, /teacherAgenda\?: TeacherAgendaItem\[\]/);
  assert.match(classroomTypes, /workLogs\?: WorkLog\[\]/);
  assert.match(app, /<ScheduleHub data=\{workspace\.data\} update=\{updateData\}/);
  assert.match(app, /<TeacherAgenda data=\{data\} update=\{update\} mobile/);
  assert.match(scheduleHub, /班级课表/);
  assert.match(scheduleHub, /我的日程与留痕/);
  assert.match(teacherAgenda, /完成并留痕/);
  assert.match(teacherAgenda, /completeAgendaWithLog/);
  assert.match(scheduleOperations, /find\(log => log\.agendaId === agenda\.id\)/);
  assert.match(scheduleOperations, /agendaId: agenda\.id/);
});

test("dashboard reuses dated teacher agenda instead of maintaining a second todo list", () => {
  assert.match(dashboardReadModel, /teacherAgendaForClass/);
  assert.match(dashboardReadModel, /item\.date === date/);
  assert.match(dashboardReadModel, /item\.status !== '已完成'/);
  assert.match(app, /<DashboardView data=\{data\}/);
  assert.match(app, /<DashboardView[^>]*data=\{workspace\.data\}/);
  assert.doesNotMatch(dashboard, /useState/);
  assert.doesNotMatch(dashboard, /<main/);
  assert.match(dashboard, /aria-labelledby="dashboard-title"/);
  assert.match(app, /sequence: current\.sequence \+ 1/);
  assert.match(app, /growthRequest\.sequence/);
});

test("student profile keeps guardians and care information out of the roster list", () => {
  assert.match(classroomTypes, /export type Guardian/);
  assert.match(classroomTypes, /export type CareProfile/);
  assert.match(classroomTypes, /guardians\?: Guardian\[\]/);
  assert.match(classroomTypes, /careProfiles\?: CareProfile\[\]/);
  assert.match(studentView, /<StudentProfile student=/);
  assert.match(studentProfileOperations, /guardians: \[\.\.\.\(current\.guardians \?\? \[\]\)\.filter/);
  assert.match(studentProfile, /仅在本详情内向班主任显示/);
  assert.match(studentProfile, /visibleScope: '班主任'/);
  assert.match(studentProfile, /考勤历史/);
  assert.match(studentProfile, /空白日期不代表缺勤/);
});

test("score trends compare normalized rates and preserve missing-score meaning", () => {
  assert.match(app, /<ScoreTrends data=\{data\} classId=/);
  assert.match(scoreTrends, /按得分率比较不同满分/);
  assert.match(scoreTrends, /空白表示未录入，不等同于零分/);
  assert.match(scoreTrends, /至少需要两场已保存考试/);
});

test("score analysis keeps new-exam entry visible on both desktop and mobile", () => {
  assert.match(app, /className="score5-primary" onClick=\{addExam\}>新增考试<\/button>/);
  assert.match(app, /onClick=\{openExamEdit\}>编辑考试<\/button>/);
  assert.doesNotMatch(app, /<details className="score5-more-actions">/);
  assert.match(app, /className="mobile-score-hero-actions"/);
  assert.match(app, /className="primary" onClick=\{openNewExam\}>新增考试<\/button>/);
});

test("exam analysis separates trend and paper workflows with teacher review", () => {
  assert.match(classroomTypes, /export type ScoreKnowledgeItem/);
  assert.match(classroomTypes, /export type ScorePaperAnalysis/);
  assert.match(classroomTypes, /knowledgeItems\?: ScoreKnowledgeItem\[\]/);
  assert.match(classroomTypes, /paperAnalyses\?: ScorePaperAnalysis\[\]/);
  assert.match(app, /score5-workspace-tabs/);
  assert.match(app, /<ScoreItemAnalysis data=\{data\} classId=\{[^}]+\} workspaceToken=\{workspaceToken\} exam=\{exam\} students=/);
  assert.match(scoreItemAnalysis, /空白为未录入，不按零分计算/);
  assert.match(scoreItemAnalysis, /不自动给学生或班级下结论/);
  assert.match(scoreItemAnalysis, /开始 AI 识别/);
  assert.match(scoreItemAnalysis, /确认并加入统计/);
  assert.match(scoreOperations, /if \(value == null\) delete nextStudentScores\[subject\]/);
  assert.match(scoreOperations, /paper\.status !== '待核对'/);
  assert.doesNotMatch(app, /student\.score \+ \[-2, 1, 0, -4, 3\]/);
  assert.doesNotMatch(app, /function defaultScoreExam/);
  assert.match(app, /还没有可反思的考试/);
  assert.match(examPaperRoute, /EXAM_AI_ENDPOINT/);
  assert.match(examPaperRoute, /EXAM_AI_API_KEY/);
  assert.match(examPaperRoute, /仅支持 JPG、PNG、WEBP 或 PDF 试卷/);
});

test("exam reflections share guarded save logic across desktop and mobile", () => {
  assert.match(app, /examReflectionsForClass\(data, activeClass\.id\)/);
  assert.match(app, /saveExamReflection\(data, activeClass\.id/);
  assert.match(app, /saveExamReflection\(data, activeClassId/);
  assert.match(app, /当前为只读模式，反思内容未修改/);
  assert.match(app, /成绩未录入/);
  assert.match(classroomTypes, /reflectionId\?: string/);
  assert.match(reflectionOperations, /linkedRecord\?\.id \?\? createRecordId\(\)/);
  assert.match(reflectionOperations, /status !== '已完成'/);
  assert.match(reflectionOperations, /followUpStudentIds: \(item\.followUpStudentIds/);
});

test("classroom tools exclude leave and do not turn random picks into points", () => {
  assert.match(classroomTypes, /export type ClassroomToolSession/);
  assert.match(classroomTypes, /classroomToolSessions\?: ClassroomToolSession\[\]/);
  assert.match(shellCatalog, /id: 'tools', label: '课堂工具'/);
  assert.match(app, /active === "tools"/);
  assert.match(classroomToolsOperations, /item\.status === '请假'/);
  assert.match(classroomTools, /drawClassroomStudent/);
  assert.match(classroomTools, /createTemporaryGrouping/);
  assert.match(app, /<ClassroomTools data=\{workspace\.data\} update=\{updateData\} readOnly=\{isDemo \|\| isReadOnly\}/);
  assert.match(classroomTools, /默认不写入积分/);
  assert.match(classroomTools, /本轮所有可参与学生均已抽到/);
});

test("points table keeps bulk selection compact and accessible", () => {
  assert.match(app, /className="pointdesk-select-all"/);
  assert.match(app, /aria-label="全选当前筛选学生"/);
});

test("notification drafts are copyable records, never a claimed external send", () => {
  assert.match(classroomTypes, /export type NotificationDraft/);
  assert.match(classroomTypes, /notificationDrafts\?: NotificationDraft\[\]/);
  assert.match(app, /<NotificationDrafts data=\{data\} update=\{update\}/);
  assert.match(notificationDrafts, /系统不自动外发/);
  assert.match(notificationDrafts, /copyTextToClipboard/);
  assert.match(clipboard, /navigator\.clipboard\.writeText/);
  assert.doesNotMatch(notificationDrafts, /navigator\.clipboard\.writeText/);
  assert.match(notificationDrafts, /saveNotificationReceipt/);
  assert.match(notificationOperations, /status: '已记录回执'/);
});

test("dialogs use unique titles and keyboard focus management", () => {
  assert.match(app, /const titleId = useId\(\)/);
  assert.match(dialogBehavior, /event\.key==='Escape'/);
  assert.match(dialogBehavior, /restoreFocus\.focus/);
  assert.match(sharedDialog, /<ModalLayer/);
  assert.match(modalLayer, /bodyRef\.current\.scrollTop = 0/);
  assert.match(modalLayer, /data-workbench-dialog="next"/);
  assert.match(dialogBehavior, /dialog\[data-workbench-dialog=/);
  assert.doesNotMatch(app, /id="mobile-info-title"/);
});
