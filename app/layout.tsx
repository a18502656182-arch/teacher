import type { Metadata } from "next";
import { DialogAccessibility } from "./components/campus/DialogAccessibility";
import "./globals.css";
import "./styles/legacy-scoped.css";

export const metadata: Metadata = {
  title: "班主任工作台",
  description: "把学生、作业、积分、值日、沟通、成绩和评语整合到一个班级工作台。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN" data-theme="campus"><body>
    <template
      data-design-contract="CAMPUS-OPERATE-C1C6-20260911"
      dangerouslySetInnerHTML={{ __html: "<!-- THESIS: 班主任每天先看待办再进入学生或任务详情，拒绝无顶栏的通用后台入口墙。 OWN-WORLD: 暖白工作纸、天空蓝主操作、粉笔绿完成、暖黄待办、珊瑚红风险、深海军蓝；课堂水彩插画与线面SVG。 STORY: 确认班级和保存状态，然后处理今日任务，进入主从工作区，服务器确认后继续。 FIRST VIEWPORT: 桌面68px顶栏、240px分组侧栏、任务主场景和一个主操作；手机56px顶栏、纵向单任务流程和安全区操作栏。 FORM: operate/reference-led master-detail, seed CAMPUS-OPERATE-C1C6-20260911. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md -->" }}
    />
    {children}<DialogAccessibility/>
  </body></html>;
}
