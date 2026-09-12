import type { PointRule } from '@/lib/classroom';

export const defaultPointRules: PointRule[] = [
  { id: 'pr-class-speak', scene: '课堂', title: '主动表达', reason: '主动回答问题并说清思路', delta: 1, owner: '学习委员', enabled: true, level: '温和版', detail: '来自课堂提问、积极回答、精彩表现等资料场景。' },
  { id: 'pr-class-disrupt', scene: '课堂', title: '扰乱课堂', reason: '上课讲话、走神或影响同学听课', delta: -1, owner: '纪律委员', enabled: true, level: '温和版', detail: '轻微课堂问题先提醒再记录，连续出现再转入沟通。' },
  { id: 'pr-homework-good', scene: '作业', title: '优秀作业', reason: '作业完成认真，订正及时', delta: 1, owner: '课代表', enabled: true, level: '小学版', detail: '对应优秀作业、书写认真、按时订正。' },
  { id: 'pr-homework-missing', scene: '作业', title: '未交或拖拉', reason: '作业未按时提交、迟交或订正拖拉', delta: -2, owner: '课代表', enabled: true, level: '严格版', detail: '资料中常见扣分项，后续应同步到作业追踪。' },
  { id: 'pr-discipline-routine', scene: '纪律', title: '常规达标', reason: '早读、两操、路队或集会表现稳定', delta: 1, owner: '值日班长', enabled: true, level: '小学版', detail: '对应常规、三操、早读、路队等每日记录。' },
  { id: 'pr-discipline-conflict', scene: '纪律', title: '冲突顶撞', reason: '顶撞老师、班干部或与同学发生冲突', delta: -3, owner: '班长', enabled: true, level: '严格版', detail: '严重情况可按规则调整到 -5 至 -10，并补充谈心记录。' },
  { id: 'pr-health-duty', scene: '卫生', title: '主动值日', reason: '主动整理卫生角或完成值日岗位', delta: 1, owner: '劳动委员', enabled: true, level: '小学版', detail: '来自卫生、值日、承包区达标等资料。' },
  { id: 'pr-health-miss', scene: '卫生', title: '卫生未达标', reason: '值日不到位或座位周边不整洁', delta: -1, owner: '劳动委员', enabled: true, level: '温和版', detail: '适合轻量记录，避免只惩罚不补救。' },
  { id: 'pr-group-activity', scene: '集体活动', title: '集体贡献', reason: '代表班级参与活动或主动服务集体', delta: 2, owner: '班长', enabled: true, level: '初中版', detail: '参考集体活动、黑板报、比赛、班级服务。' },
  { id: 'pr-group-award', scene: '集体活动', title: '竞赛获奖', reason: '代表班级参赛获奖或被学校表扬', delta: 5, owner: '班长', enabled: true, level: '严格版', detail: '资料中常见 3-8 分或更高奖励，可按学校情况调整。' },
  { id: 'pr-manner-help', scene: '文明礼仪', title: '文明互助', reason: '帮助同学，文明沟通有示范作用', delta: 1, owner: '班长', enabled: true, level: '小学版', detail: '可沉淀为文明礼仪之星、期末评语证据。' },
  { id: 'pr-cadre-duty', scene: '班干部', title: '履职认真', reason: '班干部或课代表认真完成职责', delta: 2, owner: '班主任', enabled: true, level: '自定义', detail: '参考班干部每周履职奖励，适合周五汇总。' },
];
