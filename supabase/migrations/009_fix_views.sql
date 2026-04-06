-- 009: Fix v_monthly_cash to separate facturacion from cash_ventas_nuevas, and add saldo_pendiente_30d
-- cash_ventas_nuevas now only includes cuota 1 (not cuota 2+3)
-- facturacion = sum of ticket_total for new sales (total sold, not just collected)
-- saldo_pendiente_30d = overdue pending payments in last 30 days

CREATE OR REPLACE VIEW v_monthly_cash AS
SELECT
  get_month_7_7(p.fecha_pago) AS mes_fiscal,
  sum(p.monto_usd) FILTER (WHERE NOT p.es_renovacion AND p.numero_cuota = 1) AS cash_ventas_nuevas,
  sum(p.monto_usd) FILTER (WHERE p.es_renovacion) AS cash_renovaciones,
  sum(p.monto_usd) FILTER (WHERE p.numero_cuota > 1 AND NOT p.es_renovacion) AS cash_cuotas,
  sum(p.monto_usd) AS cash_total,
  sum(l.ticket_total) FILTER (WHERE NOT p.es_renovacion AND p.numero_cuota = 1) AS facturacion,
  count(DISTINCT p.lead_id) FILTER (WHERE NOT p.es_renovacion AND p.numero_cuota = 1) AS ventas_nuevas_count,
  count(*) FILTER (WHERE p.es_renovacion AND p.numero_cuota = 1) AS renovaciones_count,
  (SELECT coalesce(sum(pp.monto_usd), 0)
   FROM payments pp
   WHERE pp.estado = 'pendiente'
     AND pp.fecha_vencimiento <= CURRENT_DATE
     AND pp.fecha_vencimiento >= CURRENT_DATE - interval '30 days'
  ) AS saldo_pendiente_30d
FROM payments p
LEFT JOIN leads l ON p.lead_id = l.id
WHERE p.estado = 'pagado' AND p.fecha_pago IS NOT NULL
GROUP BY get_month_7_7(p.fecha_pago);
