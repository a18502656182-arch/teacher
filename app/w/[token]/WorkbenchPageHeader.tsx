import { CampusIcon, ThemeArtwork } from "@/app/components/campus/primitives";
import type { ReactNode } from "react";
import styles from "./WorkbenchPageHeader.module.css";

export type WorkbenchPageTone = "sky" | "coral" | "jade" | "marigold" | "iris" | "lake" | "berry";

export function WorkbenchPageHeader({
  icon,
  title,
  description,
  meta,
  actions,
  tone = "sky",
}: {
  icon: string;
  title: string;
  description: string;
  meta?: ReactNode;
  actions?: ReactNode;
  tone?: WorkbenchPageTone;
}) {
  const artwork = icon === "🎒" ? "roster" : icon === "📚" ? "homework" : undefined;
  return <header className={`${styles.header} ${styles[tone]} ${artwork ? styles.illustrated : ""}`}>
    <span className={styles.marker} aria-hidden="true">{artwork ? <ThemeArtwork slot={artwork}/> : <CampusIcon name={icon}/>}</span>
    <div className={styles.copy}>
      <h2>{title}</h2>
      <p>{description}</p>
      {meta ? <span className={styles.meta}>{meta}</span> : null}
    </div>
    {actions ? <div className={styles.actions}>{actions}</div> : null}
  </header>;
}
