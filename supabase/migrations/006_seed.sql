-- Seed team members
INSERT INTO team_members (nombre, etiqueta, rol, is_admin, is_closer, is_setter, is_cobranzas, is_seguimiento, comision_pct, can_see_agent, pin) VALUES
  ('Lauti', 'lauti', 'admin', true, false, false, false, false, 0, false, '1001'),
  ('Mel', 'mel', 'admin', true, false, false, true, false, 0.10, true, '1002'),
  ('Juanma', 'juanma', 'admin', true, false, false, false, false, 0, false, '1003'),
  ('Iván', 'ivan', 'closer', false, true, false, false, false, 0.10, false, '2001'),
  ('Joaquín', 'joaquin', 'setter', false, false, true, false, false, 0.05, false, '3001'),
  ('Jorge', 'jorge', 'setter_closer', false, true, true, false, false, 0.05, false, '3002'),
  ('Pepito', 'pepito', 'seguimiento', false, false, false, false, true, 0, false, '4001');

-- Seed payment methods
INSERT INTO payment_methods (nombre, titular, tipo_moneda) VALUES
  ('JUANMA', 'Juanma Wohl', 'usd'),
  ('Cuenta pesos Lauti', 'Lautaro Cardozo', 'ars'),
  ('Cuenta dolares Lauti', 'Lautaro Cardozo', 'usd'),
  ('Efectivo', NULL, 'usd'),
  ('Binance lauti', 'Lautaro Cardozo', 'usd'),
  ('Stripe', 'Lautaro Cardozo', 'usd'),
  ('Financiera Payments', NULL, 'usd'),
  ('Becheq', NULL, 'ars');
