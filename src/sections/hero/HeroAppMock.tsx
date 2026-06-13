import { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { useTranslation } from "react-i18next";
import { computeInitialScale, deriveSceneState, stepFromProgress } from "./mock-data";
import { WindowChrome } from "./WindowChrome";
import { MockGrid } from "./MockGrid";
import { MockContextMenu } from "./MockContextMenu";
import { MockStatusBar } from "./MockStatusBar";
import { MockCursor } from "./MockCursor";
import { MockToast } from "./MockToast";

export function HeroAppMock(): JSX.Element {
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

  return (
    <div ref={trackRef} className="relative h-[140vh]">
      <div className="sticky top-0 flex h-screen items-center justify-center">
        <motion.div
          role="img"
          aria-label={t("hero.dashboardAlt")}
          style={{ scale }}
          className="relative w-[88vw] max-w-[1340px] origin-center overflow-hidden rounded-xl border border-surface-container-highest bg-white shadow-2xl will-change-transform"
        >
          <WindowChrome />
          <div className="relative h-[620px] overflow-hidden bg-white">
            <MockGrid selected={scene.selected} />
            <MockContextMenu
              open={scene.menuOpen}
              submenuOpen={scene.submenuOpen}
              highlightQuery={scene.highlightQuery}
              highlightInsert={scene.highlightInsert}
            />
            <MockCursor
              x={scene.cursor.x}
              y={scene.cursor.y}
              clicking={scene.cursor.clicking}
            />
            <MockToast visible={scene.toastVisible} />
          </div>
          <MockStatusBar selected={scene.selected} />
        </motion.div>
      </div>
    </div>
  );
}
