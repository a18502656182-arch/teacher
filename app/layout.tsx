import type { Metadata } from "next";
import "./globals.css";
import "./public-entry.css";
import "./workbench-repair.css";

export const metadata: Metadata = {
  title: "班主任工作台",
  description: "把学生、作业、积分、值日、沟通、成绩和评语整合到一个班级工作台。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
