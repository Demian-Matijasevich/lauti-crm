-- Fix v_commissions: replace old CROSS JOIN version with correct filtered JOIN
DROP VIEW IF EXISTS v_commissions CASCADE;

CREATE VIEW v_commissions AS
SELECT
  tm.id AS team_member_id,
  tm.nombre,
  get_month_7_7(p.fecha_pago) AS mes_fiscal,
  coalesce(sum(p.monto_usd) FILTER (WHERE l.closer_id = tm.id), 0) * 0.10 AS comision_closer,
  coalesce(sum(p.monto_usd) FILTER (WHERE l.setter_id = tm.id), 0) * 0.05 AS comision_setter,
  coalesce(sum(p.monto_usd) FILTER (WHERE p.cobrador_id = tm.id AND (p.numero_cuota > 1 OR p.es_renovacion)), 0) * 0.10 AS comision_cobranzas,
  coalesce(sum(p.monto_usd) FILTER (WHERE l.closer_id = tm.id), 0) * 0.10
  + coalesce(sum(p.monto_usd) FILTER (WHERE l.setter_id = tm.id), 0) * 0.05
  + coalesce(sum(p.monto_usd) FILTER (WHERE p.cobrador_id = tm.id AND (p.numero_cuota > 1 OR p.es_renovacion)), 0) * 0.10 AS comision_total
FROM team_members tm
JOIN payments p ON (p.lead_id IN (SELECT id FROM leads WHERE closer_id = tm.id OR setter_id = tm.id) OR p.cobrador_id = tm.id)
LEFT JOIN leads l ON p.lead_id = l.id
WHERE p.estado = 'pagado' AND p.fecha_pago IS NOT NULL AND tm.activo = true
GROUP BY tm.id, tm.nombre, get_month_7_7(p.fecha_pago);
