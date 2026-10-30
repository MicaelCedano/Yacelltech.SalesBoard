"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Crown, Trophy, Users } from "lucide-react";
import { RankedSellerStat } from "@/types/salesboard";
import { AvatarBadge } from "@/components/ui/avatar-badge";
import { AnimatedNumber } from "@/components/ui/animated-number";

export function VerticalSellersChart({ sellers, title = "Ranking de puntos", staticDisplay = false, goalMonths = 1, prizeName, prizeValue, sellerGoal }: { sellers: RankedSellerStat[]; title?: string; staticDisplay?: boolean; goalMonths?: number; prizeName?: string | null; prizeValue?: number | null; sellerGoal?: number }) {
  const prefersReducedMotion = useReducedMotion();
  const reducedMotion = staticDisplay || prefersReducedMotion;
  return (
    <section className="sellers-chart" aria-label="Gráfico vertical de puntos por vendedor">
      <div className="chart-heading"><h1>{title}</h1><span>{sellers.length} {sellers.length === 1 ? "vendedor" : "vendedores"}</span></div>
      {(Boolean((prizeName ?? "").trim()) || Math.max(0, Math.floor(prizeValue ?? 0)) > 0) && (
        <div className="chart-prize-banner" role="region" aria-label="Premio de la meta">
          <div className="chart-prize-main">
            <span className="chart-prize-icon" aria-hidden="true"><Trophy size={18} strokeWidth={2} /></span>
            <div className="chart-prize-copy">
              <span className="chart-prize-kicker">Premio de la meta</span>
              <strong className="chart-prize-title">{(prizeName ?? "").trim() || "Premio por meta cumplida"}</strong>
            </div>
          </div>
          <div className="chart-prize-meta">
            {Math.max(0, Math.floor(prizeValue ?? 0)) > 0 && (
              <span className="chart-prize-price">RD${Math.max(0, Math.floor(prizeValue ?? 0)).toLocaleString("es-DO")}</span>
            )}
            {(sellers[0]?.effectiveGoal ?? Math.max(0, (sellerGoal ?? 400) * Math.max(1, goalMonths))) > 0 && (
              <span className="chart-prize-points">
                {goalMonths > 1 ? `Meta (${goalMonths} meses):` : "Meta:"} {(sellers[0]?.effectiveGoal ?? Math.max(0, (sellerGoal ?? 400) * Math.max(1, goalMonths))).toLocaleString("es-DO")} puntos
              </span>
            )}
          </div>
        </div>
      )}
      {sellers.length === 0 ? <div className="chart-empty"><Users size={32} strokeWidth={1.4} aria-hidden="true" /><h2>El equipo está por llegar.</h2><p>Los vendedores aparecerán aquí cuando estén disponibles.</p></div> : (
        <div className="chart-scroll" tabIndex={0} aria-label="Vendedores ordenados por puntos de mayor a menor; desplaza horizontalmente para ver más">
          <div className="seller-columns" data-count={sellers.length}>
            <AnimatePresence initial={false}>
              {sellers.map((item) => (
                <motion.article key={item.seller.id} layout={!reducedMotion} initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.4 }} className="seller-column" data-seller-id={item.seller.id} data-rank={item.rank} aria-label={`${item.seller.full_name}: ${item.unitsSold} ${item.unitsSold === 1 ? "punto" : "puntos"}${item.rank ? `, posición ${item.rank}` : ""}`}>
                  <div className="seller-identity">
                    <div className="seller-avatar-wrap">
                      <AvatarBadge className="seller-avatar" src={item.seller.avatar_url} name={item.seller.full_name} size="tv" />
                      {item.rank === 1 && <span className="seller-leader-badge" role="img" aria-label={item.isTied ? "Primer lugar compartido" : "Primer lugar"}><Crown fill="currentColor" strokeWidth={1.8} aria-hidden="true" /></span>}
                    </div>
                    <div className="seller-name"><h2 title={item.seller.full_name}>{item.seller.full_name}</h2></div>
                    <span className="seller-rank">{item.rank ? `${item.isTied ? "Empate · " : ""}${item.rank}.º lugar` : "Sin ventas aún"}</span>
                  </div>
                  <div className="seller-bar-stage" aria-hidden="true">
                    <div className="seller-bar-track">
                      <motion.div className="seller-bar" initial={reducedMotion ? false : { height: 0 }} animate={{ height: `${item.barHeightPercent}%` }} transition={{ duration: reducedMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }} data-bar-percent={item.barHeightPercent} />
                      <motion.div className="seller-bar-label" initial={false} animate={{ bottom: `${item.barHeightPercent}%` }} transition={{ duration: reducedMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}>
                        <AnimatedNumber className="seller-units" value={item.unitsSold} staticDisplay={staticDisplay} />
                        <span className="seller-unit-label">{item.unitsSold === 1 ? "Punto" : "Puntos"}</span>
                      </motion.div>
                    </div>
                  </div>
                  <div className="seller-stats">
                    {item.effectiveGoal > 0 ? <>
                      <div className="seller-goal" data-complete={item.isGoalCompleted}>{item.isGoalCompleted && <Check size={16} aria-hidden="true" />}<AnimatedNumber value={item.goalCompletionPercent} staticDisplay={staticDisplay} /><span>%</span><small>de meta</small></div>
                      <p className="seller-meta-label">{goalMonths > 1 ? `Meta de ${goalMonths} meses` : "Meta mensual"} {item.effectiveGoal.toLocaleString("es-DO")} puntos</p>
                      <div className="seller-goal-track" role="progressbar" aria-label={`Meta de ${item.seller.full_name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, item.goalCompletionPercent)} aria-valuetext={`${item.unitsSold} de ${item.effectiveGoal} puntos · ${item.goalCompletionPercent}%`}>
                        <motion.div initial={false} animate={{ width: `${Math.min(100, item.goalCompletionPercent)}%` }} transition={{ duration: reducedMotion ? 0 : 0.4 }} data-complete={item.isGoalCompleted} />
                      </div>
                    </> : <p className="seller-meta-label">Sin meta configurada</p>}
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </section>
  );
}
