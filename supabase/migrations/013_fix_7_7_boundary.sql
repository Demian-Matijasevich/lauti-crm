-- Fix 7-7 fiscal month boundary: day 7 belongs to PREVIOUS month (it's the last day, not the first)

CREATE OR REPLACE FUNCTION get_month_7_7(d date)
RETURNS text AS $$
DECLARE
  adjusted date;
  month_names text[] := ARRAY[
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
  ];
BEGIN
  -- If day <= 7, the fiscal month is the previous calendar month
  -- (the 7th is the LAST day of the previous period, not the first of the new one)
  IF EXTRACT(DAY FROM d) <= 7 THEN
    adjusted := d - interval '1 month';
  ELSE
    adjusted := d;
  END IF;
  RETURN month_names[EXTRACT(MONTH FROM adjusted)::int] || ' ' || EXTRACT(YEAR FROM adjusted)::text;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Also fix current_fiscal_start: the 8th is the real start, not the 7th
CREATE OR REPLACE FUNCTION current_fiscal_start()
RETURNS date AS $$
BEGIN
  IF EXTRACT(DAY FROM CURRENT_DATE) > 7 THEN
    RETURN make_date(
      EXTRACT(YEAR FROM CURRENT_DATE)::int,
      EXTRACT(MONTH FROM CURRENT_DATE)::int,
      8
    );
  ELSE
    RETURN make_date(
      EXTRACT(YEAR FROM (CURRENT_DATE - interval '1 month'))::int,
      EXTRACT(MONTH FROM (CURRENT_DATE - interval '1 month'))::int,
      8
    );
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION current_fiscal_end()
RETURNS date AS $$
BEGIN
  RETURN current_fiscal_start() + interval '1 month' - interval '1 day';
END;
$$ LANGUAGE plpgsql STABLE;
