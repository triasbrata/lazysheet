import { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { useTranslation } from "react-i18next";
import { computeInitialScale, deriveSceneState, stepFromProgress, THEMES, themeVars } from "./mock-data";
import { WindowChrome } from "./WindowChrome";
import { MockGrid } from "./MockGrid";
import { MockSettings } from "./MockSettings";
import { MockStatusBar } from "./MockStatusBar";
import { MockCursor } from "./MockCursor";
import { MockToast } from "./MockToast";

export function HeroAppMock({ version }: { version: string }): JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  });
  const [initialScale, setInitialScale] = useState(1);
  useEffect(() => {
    const update = () =>
      setInitialScale(computeInitialScale(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  // Shrink 80vw -> final over the first 20% of the track; motion clamps past 0.2,
  // so the app then HOLDS fully visible for the rest of the track.
  const scale = useTransform(scrollYProgress, [0, 0.2], [initialScale, 1]);
  const { t } = useTranslation();

  const [step, setStep] = useState(0);
  useEffect(() => {
    return scrollYProgress.on("change", (v) => {
      setStep(stepFromProgress(v));
    });
  }, [scrollYProgress]);

  const scene = deriveSceneState(step);
  const theme = THEMES[scene.appliedThemeId];

  return (
    <div ref={trackRef} className="relative h-[140vh]">
      <div className="sticky top-0 flex h-screen items-center justify-center">
        <motion.div
          role="img"
          aria-label={t("hero.dashboardAlt")}
          style={{ scale, ...themeVars(theme), borderColor: 'var(--m-border)' }}
          className="relative w-[88vw] max-w-[1340px] origin-center overflow-hidden rounded-xl border bg-[var(--m-bg)] shadow-2xl transition-colors duration-500 will-change-transform"
        >
          <WindowChrome />
          <div className="relative h-[620px] overflow-hidden bg-[var(--m-bg)] transition-colors duration-500">
            <MockGrid />
            <MockSettings
              open={scene.settingsOpen}
              themeMenuOpen={scene.themeMenuOpen}
              highlightId={scene.highlightId}
              appliedThemeId={scene.appliedThemeId}
            />
            <MockCursor
              x={scene.cursor.x}
              y={scene.cursor.y}
              clicking={scene.cursor.clicking}
            />
            <MockToast visible={scene.toastVisible} />
          </div>
          <MockStatusBar version={version} />
        </motion.div>
      </div>
    </div>
  );
}
