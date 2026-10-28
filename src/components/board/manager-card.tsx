"use client";

import { motion, useReducedMotion } from "motion/react";
import { Check } from "lucide-react";
import { ManagerSummaryStat } from "@/types/salesboard";
import { AvatarBadge } from "@/components/ui/avatar-badge";
import { AnimatedNumber } from "@/components/ui/animated-number";

export function ManagerCard({ manager, staticDisplay = false }: { manager: ManagerSummaryStat; staticDisplay?: boolean }) {
  const prefersReducedMotion = useReducedMotion();
  const reducedMotion = staticDisplay || prefersReducedMotion;
  return (
    <section className="manager-card" aria-label="Resumen del Manager General">
      <div className="manager-identity">
        <AvatarBadge src={manager.managerAvatarUrl} name={manager.managerName} size="xl" />
        <div><p className="manager-label">{manager.managerLabel || "Manager General"}</p><h2>{manager.managerName}</h2></div>
      </div>
      <div className="manager-total"><AnimatedNumber value={manager.totalUnitsSold} staticDisplay={staticDisplay} /><p>Puntos globales</p></div>
      <div className="manager-progress">
        <div className="manager-percentage" data-complete={manager.isGoalMet}><AnimatedNumber value={manager.completionPercent} staticDisplay={staticDisplay} />%</div>
        <div className="progress-track" role="progressbar" aria-label="Cumplimiento de la meta general" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, manager.completionPercent)} aria-valuetext={`${manager.completionPercent}% · ${manager.totalUnitsSold} de ${manager.generalGoal} puntos`}>
          <motion.div initial={false} animate={{ width: `${manager.progressBarWidthPercent}%` }} transition={{ duration: reducedMotion ? 0 : 0.4 }} className="progress-fill" data-complete={manager.isGoalMet} />
        </div>
        <div className="manager-progress-labels"><span>Meta {manager.generalGoal.toLocaleString("es-DO")} puntos</span>
          {manager.isGoalMet ? <span className="goal-complete"><Check size={16} aria-hidden="true" /> Meta completada</span> : <span>{manager.generalGoal === 0 ? "Sin meta configurada" : `Faltan ${manager.remainingUnits.toLocaleString("es-DO")} puntos`}</span>}
        </div>
      </div>
    </section>
  );
}
