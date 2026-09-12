import { CampusIcon, ThemeArtwork } from "@/app/components/campus/primitives";
import type { ArtworkSlot } from "@/app/components/campus/theme";
import type { ReactNode } from "react";
import styles from "@/app/components/campus/PageHeader.module.css";

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
  const artworkByIcon: Record<string, ArtworkSlot> = {
    students: "roster", "🎒": "roster", "🌱": "roster",
    homework: "homework", "📚": "homework", "🧾": "homework",
    "📈": "assessment", "📝": "assessment",
    "💬": "communication", "✍️": "communication", "🩺": "care",
    "🗂️": "planning", "🗓️": "planning", "🎲": "tools", "🪑": "planning", "🧹": "planning", cadres: "cadres", "🎖️": "cadres", "📏": "planning", "🗞️": "planning", "⭐": "planning",
  };
  const artwork = artworkByIcon[icon] ?? "planning";
  const compactMarker = icon === "students" || icon === "homework" || icon === "duty";
  return <header className={`${styles.header} ${styles[tone]} ${compactMarker ? "" : styles.illustrated}`}>
    <span className={styles.marker} aria-hidden="true">{compactMarker ? <CampusIcon name={icon}/> : <ThemeArtwork slot={artwork}/>}</span>
    <div className={styles.copy}>
      <h2>{title}</h2>
      <p>{description}</p>
      {meta ? <span className={styles.meta}>{meta}</span> : null}
    </div>
    {actions ? <div className={styles.actions}>{actions}</div> : null}
  </header>;
}
