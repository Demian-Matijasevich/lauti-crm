DROP VIEW IF EXISTS v_monthly_cash CASCADE;

CREATE VIEW v_monthly_cash AS
SELECT
  get_month_7_7(p.fecha_pago) AS mes_fiscal,
  sum(p.monto_usd) FILTER (WHERE NOT p.es_renovacion AND p.numero_cuota = 1 AND p.estado = 'pagado') AS cash_ventas_nuevas,
  sum(p.monto_usd) FILTER (WHERE p.es_renovacion AND p.estado = 'pagado') AS cash_renovaciones,
  sum(p.monto_usd) FILTER (WHERE p.numero_cuota > 1 AND NOT p.es_renovacion AND p.estado = 'pagado') AS cash_cuotas,
  coalesce(sum(p.monto_usd) FILTER (WHERE p.estado = 'pagado'), 0)
    - coalesce(sum(p.monto_usd) FILTER (WHERE p.estado = 'refund'), 0) AS cash_total,
  sum(p.monto_usd) FILTER (WHERE p.estado = 'refund') AS refunds,
  sum(l.ticket_total) FILTER (WHERE NOT p.es_renovacion AND p.numero_cuota = 1 AND p.estado = 'pagado') AS facturacion,
  count(DISTINCT p.lead_id) FILTER (WHERE NOT p.es_renovacion AND p.numero_cuota = 1 AND p.estado = 'pagado') AS ventas_nuevas_count,
  count(*) FILTER (WHERE p.es_renovacion AND p.numero_cuota = 1 AND p.estado = 'pagado') AS renovaciones_count,
  (SELECT coalesce(sum(pp.monto_usd), 0)
   FROM payments pp
   WHERE pp.estado = 'pendiente'
     AND pp.fecha_vencimiento <= CURRENT_DATE
     AND pp.fecha_vencimiento >= CURRENT_DATE - interval '30 days'
  ) AS saldo_pendiente_30d
FROM payments p
LEFT JOIN leads l ON p.lead_id = l.id
WHERE p.fecha_pago IS NOT NULL AND p.estado IN ('pagado', 'refund')
GROUP BY get_month_7_7(p.fecha_pago);
