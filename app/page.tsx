import Link from "next/link";

const features = [
  ["座位与分组", "自动排座、拖动调整、轮换留痕"],
  ["值日与岗位", "公平轮换、工作量统计、打印公示"],
  ["作业与积分", "缺交订正闭环，表现随手记录"],
  ["成绩与帮扶", "识别波动、偏科和需要关注的学生"],
  ["成长与沟通", "谈话、家访和家长沟通自动归档"],
  ["评语与奖状", "日常记录直接生成期末成果"],
];

export default function Home() {
  return (
    <main className="landing">
      <nav className="landing-nav"><div className="brand"><span className="brand-mark">班</span><span>班主任云工具箱</span></div><a href="#features">功能总览</a></nav>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">班主任资料，不再是一堆文件</div>
          <h1>一个链接，<br/><span>管好一个班。</span></h1>
          <p>学生名单只录一次，座位、值日、作业、积分、成绩、家校沟通、期末评语和奖状全部联动。</p>
          <div className="hero-actions"><Link className="primary-btn" href="/w/demo">进入演示班级</Link><span>无需下载 · 手机电脑都能用</span></div>
          <div className="hero-proof"><b>1,183</b> 份班主任资料已整理为 <b>10</b> 个高频工具模块</div>
        </div>
        <div className="hero-panel">
          <div className="panel-head"><span>向阳小学三年级2班</span><small>今天 4 项待办</small></div>
          <div className="mini-stats"><div><b>24</b><span>学生</span></div><div><b>2</b><span>作业待跟进</span></div><div><b>3</b><span>本周进步</span></div></div>
          <div className="today-card"><span className="dot orange"></span><div><b>数学作业订正</b><small>王子谦、罗浩然待复查</small></div><em>去处理</em></div>
          <div className="today-card"><span className="dot teal"></span><div><b>本周值日轮换</b><small>第4组 · 黑板、地面、讲台</small></div><em>已安排</em></div>
          <div className="today-card"><span className="dot purple"></span><div><b>成长记录</b><small>周雨桐课堂表达 +1</small></div><em>刚刚</em></div>
        </div>
      </section>
      <section id="features" className="feature-section"><div className="section-heading"><span>不是模板下载站</span><h2>把静态表格变成真正能用的工具</h2></div><div className="feature-grid">{features.map(([title, text], i) => <article key={title}><span>0{i + 1}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
      <footer><div className="brand"><span className="brand-mark">班</span><span>班主任云工具箱</span></div><p>让资料真正替老师省时间。</p></footer>
    </main>
  );
}
