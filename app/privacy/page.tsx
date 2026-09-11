import Link from "next/link";

export default function PrivacyPage() {
  return <main className="privacy-page">
    <article>
      <p className="entry-kicker">班主任工作台</p>
      <h1>隐私与数据说明</h1>
      <p>本系统用于班级日常管理，可能保存学生名单、成绩、作业状态、沟通记录和老师填写的评语。请仅录入开展班级管理所必需的信息。</p>
      <h2>数据归属与访问</h2>
      <p>正式工作台按账户隔离。工作台地址只用于定位数据，仍需有效账户会话和已绑定浏览器才能访问。</p>
      <h2>AI 功能</h2>
      <p>AI 编写仅在老师主动确认后启用，并只发送当前编辑所选择的资料。老师可以在评语编辑界面关闭授权；演示工作台不会向外部 AI 服务发送数据。</p>
      <h2>导出与删除</h2>
      <p>老师可在工作台导出完整 JSON 备份。需要注销并删除账户数据时，请联系管理员；管理员应先向用户提供导出文件，再执行不可恢复删除。</p>
      <h2>保留期限</h2>
      <p>工作台到期后进入 30 天只读宽限期，之后停止访问但不会自动公开或转移数据。续期可恢复使用，删除请求完成后账户和工作台数据将被清除。</p>
      <Link className="entry-secondary" href="/">返回首页</Link>
    </article>
  </main>;
}
