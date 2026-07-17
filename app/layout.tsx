import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "班主任云工具箱｜一个链接管好一个班",
  description: "把课程表、座位、值日、作业、积分、成绩、沟通、评语和奖状整合到一个班级工作台。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
