"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { Check, Crown, Users } from "lucide-react";
import { RankedSellerStat } from "@/types/salesboard";
import { AvatarBadge } from "@/components/ui/avatar-badge";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { arrangeCenteredRanking } from "@/lib/ranking-layout";

export function VerticalSellersChart({ sellers, title = "Ranking de puntos", staticDisplay = false }: { sellers: RankedSellerStat[]; title?: string; staticDisplay?: boolean }) {
  const prefersReducedMotion = useReducedMotion();
  const reducedMotion = staticDisplay || prefersReducedMotion;
  const scrollRef = useRef<HTMLDivElement>(null);
  const { orderedSellers, needsTrailingSpace } = arrangeCenteredRanking(sellers);
  const sellerOrder = orderedSellers.map((item) => item.seller.id).join(",");
  const leaderIds = sellers.filter((item) => item.rank === 1).map((item) => item.seller.id).join(",");

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !leaderIds) return;
    const centerLeaders = () => {
      const leaders = container.querySelectorAll<HTMLElement>('[data-rank="1"]');
      const first = leaders[0];
      const last = leaders[leaders.length - 1];
      if (!first || !last) return;
      const center = (first.offsetLeft + last.offsetLeft + last.offsetWidth) / 2;
      container.scrollTo({ left: Math.max(0, center - container.clientWidth / 2), behavior: "instant" });
    };
    centerLeaders();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(centerLeaders);
    observer?.observe(container);
    return () => observer?.disconnect();
  }, [leaderIds, sellerOrder]);
  return (
    <section className="sellers-chart" aria-label="Gráfico vertical de puntos por vendedor">
      <div className="chart-heading"><h1>{title}</h1><span>{sellers.length} {sellers.length === 1 ? "vendedor" : "vendedores"}</span></div>
      {sellers.length === 0 ? <div className="chart-empty"><Users size={32} strokeWidth={1.4} aria-hidden="true" /><h2>El equipo está por llegar.</h2><p>Los vendedores aparecerán aquí cuando estén disponibles.</p></div> : (
        <div ref={scrollRef} className="chart-scroll" tabIndex={0} aria-label="Vendedores; líder en el centro, desplaza horizontalmente para ver más">
          <div className="seller-columns" data-count={sellers.length}>
            <AnimatePresence initial={false}>
              {orderedSellers.map((item) => (
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
                      <p className="seller-meta-label">Meta {item.effectiveGoal.toLocaleString("es-DO")} puntos</p>
                      <div className="seller-goal-track" role="progressbar" aria-label={`Meta de ${item.seller.full_name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, item.goalCompletionPercent)} aria-valuetext={`${item.unitsSold} de ${item.effectiveGoal} puntos · ${item.goalCompletionPercent}%`}>
                        <motion.div initial={false} animate={{ width: `${Math.min(100, item.goalCompletionPercent)}%` }} transition={{ duration: reducedMotion ? 0 : 0.4 }} data-complete={item.isGoalCompleted} />
                      </div>
                    </> : <p className="seller-meta-label">Sin meta configurada</p>}
                  </div>
                </motion.article>
              ))}
              {needsTrailingSpace && <motion.div key="ranking-balance" layout={!reducedMotion} className="seller-column-spacer" aria-hidden="true" />}
            </AnimatePresence>
          </div>
        </div>
      )}
    </section>
  );
}
