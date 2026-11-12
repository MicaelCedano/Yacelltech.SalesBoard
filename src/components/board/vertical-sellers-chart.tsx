"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Crown, Flame, Moon, Trophy, Users } from "lucide-react";
import { RankedSellerStat } from "@/types/salesboard";
import { AvatarBadge } from "@/components/ui/avatar-badge";
import { AnimatedNumber } from "@/components/ui/animated-number";

export function VerticalSellersChart({
  sellers,
  title = "Ranking de puntos",
  staticDisplay = false,
  prizeName,
  prizeValue,
  showStreaks = false,
}: {
  sellers: RankedSellerStat[];
  showStreaks?: boolean;
  title?: string;
  staticDisplay?: boolean;
  goalMonths?: number;
  prizeName?: string | null;
  prizeValue?: number | null;
}) {
  const prefersReducedMotion = useReducedMotion();
  const reducedMotion = staticDisplay || prefersReducedMotion;
  const cleanPrizeName = (prizeName ?? "").trim();
  const cleanPrizeValue = Math.max(0, Math.floor(prizeValue ?? 0));
  const offCount = sellers.filter((item) => item.isDayOff).length;
  const hasPrize = Boolean(cleanPrizeName) || cleanPrizeValue > 0;

  return (
    <section className="sellers-chart" aria-label="Gráfico vertical de puntos por vendedor">
      <div className="chart-heading">
        <h1>{title}</h1>
        <span>{sellers.length - offCount} trabajando · {offCount} {offCount === 1 ? "de día libre" : "de día libre"}</span>
      </div>
      {sellers.length === 0 ? (
        <div className="chart-empty">
          <Users size={32} strokeWidth={1.4} aria-hidden="true" />
          <h2>El equipo está por llegar.</h2>
          <p>Los vendedores aparecerán aquí cuando estén disponibles.</p>
        </div>
      ) : (
        <div className="chart-scroll" tabIndex={0} aria-label="Vendedores ordenados por puntos de mayor a menor">
          <div className="seller-columns" data-count={sellers.length}>
            <AnimatePresence initial={false}>
              {sellers.map((item) => (
                <motion.article
                  key={item.seller.id}
                  layout={!reducedMotion}
                  initial={reducedMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reducedMotion ? 0 : 0.4 }}
                  className="seller-column"
                  data-seller-id={item.seller.id}
                  data-rank={item.rank}
                  data-units={item.unitsSold}
                  data-streak={showStreaks && item.rank === 1 && (item.streakDays ?? 0) >= 3}
                  aria-label={`${item.seller.full_name}: ${item.unitsSold} ${item.unitsSold === 1 ? "punto" : "puntos"}${item.rank ? `, posición ${item.rank}` : ""}`}
                >
                  <div className="seller-identity">
                    <div className="seller-avatar-wrap">
                      <AvatarBadge className="seller-avatar" src={item.seller.avatar_url} name={item.seller.full_name} size="tv" />
                      {showStreaks && item.rank === 1 && (item.streakDays ?? 0) >= 3 && (
                        <svg className="seller-laurel" viewBox="0 0 140 112" aria-hidden="true" focusable="false">
                          <g className="seller-laurel-branch" transform="translate(-4 0)">
                            <path className="seller-laurel-stem" d="M42 101C22 91 13 69 18 43C20 32 25 20 32 11" />
                            <path d="M31 17C26 7 29 2 38 0C40 8 36 14 31 17Z" />
                            <path d="M25 31C15 28 12 21 14 13C22 15 27 21 25 31Z" />
                            <path d="M23 40C24 30 29 25 36 24C37 32 32 38 23 40Z" />
                            <path d="M19 49C10 46 7 38 9 31C17 33 21 40 19 49Z" />
                            <path d="M20 58C21 48 26 43 34 43C34 51 29 57 20 58Z" />
                            <path d="M20 67C11 66 6 59 7 51C15 52 21 58 20 67Z" />
                            <path d="M24 76C23 66 28 60 36 58C38 66 33 73 24 76Z" />
                            <path d="M27 83C18 84 12 78 11 70C19 70 26 75 27 83Z" />
                            <path d="M35 92C31 83 34 76 41 72C45 79 43 87 35 92Z" />
                            <path d="M38 99C30 102 22 98 19 91C27 89 34 92 38 99Z" />
                          </g>
                          <g className="seller-laurel-branch" transform="translate(144 0) scale(-1 1)">
                            <path className="seller-laurel-stem" d="M42 101C22 91 13 69 18 43C20 32 25 20 32 11" />
                            <path d="M31 17C26 7 29 2 38 0C40 8 36 14 31 17Z" />
                            <path d="M25 31C15 28 12 21 14 13C22 15 27 21 25 31Z" />
                            <path d="M23 40C24 30 29 25 36 24C37 32 32 38 23 40Z" />
                            <path d="M19 49C10 46 7 38 9 31C17 33 21 40 19 49Z" />
                            <path d="M20 58C21 48 26 43 34 43C34 51 29 57 20 58Z" />
                            <path d="M20 67C11 66 6 59 7 51C15 52 21 58 20 67Z" />
                            <path d="M24 76C23 66 28 60 36 58C38 66 33 73 24 76Z" />
                            <path d="M27 83C18 84 12 78 11 70C19 70 26 75 27 83Z" />
                            <path d="M35 92C31 83 34 76 41 72C45 79 43 87 35 92Z" />
                            <path d="M38 99C30 102 22 98 19 91C27 89 34 92 38 99Z" />
                          </g>
                        </svg>
                      )}
                      {item.rank === 1 && (
                        <span className="seller-leader-badge" role="img" aria-label={item.isTied ? "Primer lugar compartido" : "Primer lugar"}>
                          <Crown fill="currentColor" strokeWidth={1.8} aria-hidden="true" />
                        </span>
                      )}
                    </div>
                    <div className="seller-name">
                      <h2 title={item.seller.full_name}>{item.seller.full_name}</h2>
                    </div>
                    {item.isDayOff && <span className="seller-day-off"><Moon size={13} aria-hidden="true" /> Día libre</span>}
                    {showStreaks && item.rank === 1 && (item.streakDays ?? 0) >= 3 && (
                      <span className="seller-streak" aria-label={`${item.streakDays} días consecutivos en primer lugar`}>
                        <Flame size={14} fill="currentColor" aria-hidden="true" /> Racha: {item.streakDays} días
                      </span>
                    )}
                    <span
                      className="seller-rank"
                      title={item.isTied ? `Empate en ${item.rank}.º lugar` : `${item.rank}.º lugar`}
                    >
                      {item.rank ? (
                        <>
                          <strong className="seller-rank-num">{item.rank}</strong>
                          <span>{item.isTied ? ".º · Empate" : ".º lugar"}</span>
                        </>
                      ) : (
                        "Sin ventas aún"
                      )}
                    </span>
                  </div>
                  <div className="seller-bar-stage" aria-hidden="true">
                    <div className="seller-bar-track">
                      <motion.div
                        className="seller-bar"
                        initial={reducedMotion ? false : { height: 0 }}
                        animate={{ height: `${item.barHeightPercent}%` }}
                        transition={{ duration: reducedMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
                        data-bar-percent={item.barHeightPercent}
                      />
                      <motion.div
                        className="seller-bar-label"
                        initial={false}
                        animate={{ bottom: `max(${item.barHeightPercent}%, 46px)` }}
                        transition={{ duration: reducedMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <AnimatedNumber className="seller-units" value={item.unitsSold} staticDisplay={staticDisplay} />
                        <span className="seller-unit-label">{item.unitsSold === 1 ? "Punto" : "Puntos"}</span>
                      </motion.div>
                      {item.effectiveGoal > 0 && (
                        <span className="seller-bar-goal">
                          Meta: {item.effectiveGoal.toLocaleString("es-DO")} puntos
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="seller-stats">
                    {item.effectiveGoal > 0 ? (
                      <>
                        <div className="seller-goal" data-complete={item.isGoalCompleted}>
                          {item.isGoalCompleted && <Check size={16} aria-hidden="true" />}
                          <AnimatedNumber value={item.goalCompletionPercent} staticDisplay={staticDisplay} />
                          <span>%</span>
                          <small>de meta</small>
                        </div>
                        {hasPrize && (
                          <div
                            className="seller-prize-tag"
                            data-complete={item.isGoalCompleted}
                            title={cleanPrizeName ? `${cleanPrizeName}${cleanPrizeValue > 0 ? ` · RD$ ${cleanPrizeValue.toLocaleString("es-DO")}` : ""}` : `Premio: RD$ ${cleanPrizeValue.toLocaleString("es-DO")}`}
                          >
                            <span className="seller-prize-pill">
                              <Trophy size={11} strokeWidth={2.2} aria-hidden="true" />
                              {cleanPrizeValue > 0 ? (
                                <strong>RD$ {cleanPrizeValue.toLocaleString("es-DO")}</strong>
                              ) : (
                                <strong>Premio</strong>
                              )}
                            </span>
                            {cleanPrizeName ? (
                              <span className="seller-prize-name">{cleanPrizeName}</span>
                            ) : null}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="seller-no-goal">Sin meta configurada</p>
                    )}
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
