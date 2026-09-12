import Link from "next/link";
import { CampusIcon } from "@/app/components/campus/primitives";
import styles from "./EntryPage.module.css";

export function PrivacyPage() {
  return (
    <main className={`${styles.page} ${styles.privacyPage}`}>
      <div className={styles.pageContent}>
        <header className={styles.topbar}>
          <Link className={styles.brand} href="/" aria-label="返回班主任工作台首页">
            <span><CampusIcon name="book" /></span>
            <strong>班主任工作台</strong>
          </Link>
          <Link className={styles.backLink} href="/"><CampusIcon name="arrow" />返回首页</Link>
        </header>
        <article className={styles.privacyArticle}>
          <header className={styles.privacyIntro}>
            <span className={styles.privacySeal}><CampusIcon name="lock" /></span>
            <p className={styles.kicker}>隐私与数据说明</p>
            <h1>知道保存了什么，<br />也知道如何带走</h1>
            <p>本系统用于班级日常管理，可能保存学生名单、成绩、作业状态、沟通记录和老师填写的评语。请仅录入开展班级管理所必需的信息。</p>
          </header>
          <div className={styles.privacySections}>
            <section>
              <span><CampusIcon name="user" /></span>
              <div><h2>数据归属与访问</h2><p>正式工作台按账户隔离。工作台地址只用于定位数据，仍需有效账户会话和已绑定浏览器才能访问。</p></div>
            </section>
            <section>
              <span><CampusIcon name="tools" /></span>
              <div><h2>AI 功能</h2><p>AI 编写仅在老师主动确认后启用，并只发送当前编辑所选择的资料。老师可以在评语编辑界面关闭授权；演示工作台不会向外部 AI 服务发送数据。</p></div>
            </section>
            <section>
              <span><CampusIcon name="copy" /></span>
              <div><h2>导出与删除</h2><p>老师可在工作台导出完整 JSON 备份。需要注销并删除账户数据时，请联系管理员；管理员应先向用户提供导出文件，再执行不可恢复删除。</p></div>
            </section>
            <section>
              <span><CampusIcon name="schedule" /></span>
              <div><h2>保留期限</h2><p>工作台到期后进入 30 天只读宽限期，之后停止访问但不会自动公开或转移数据。续期可恢复使用，删除请求完成后账户和工作台数据将被清除。</p></div>
            </section>
          </div>
        </article>
        <footer className={styles.footer}><span>仅录入完成班级管理所必需的信息。</span><Link href="/">返回工作台入口</Link></footer>
      </div>
    </main>
  );
}
