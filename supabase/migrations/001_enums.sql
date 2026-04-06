-- Enums for Lauti CRM

CREATE TYPE lead_fuente AS ENUM (
  'historias', 'lead_magnet', 'youtube', 'instagram', 'dm_directo',
  'historia_cta', 'historia_hr', 'comentario_manychat', 'encuesta',
  'why_now', 'win', 'fup', 'whatsapp', 'otro'
);

CREATE TYPE lead_estado AS ENUM (
  'pendiente', 'no_show', 'cancelada', 'reprogramada', 'seguimiento',
  'no_calificado', 'no_cierre', 'reserva', 'cerrado',
  'adentro_seguimiento', 'broke_cancelado'
);

CREATE TYPE lead_calificacion AS ENUM ('calificado', 'no_calificado', 'podria');

CREATE TYPE lead_score AS ENUM ('A', 'B', 'C', 'D');

CREATE TYPE programa AS ENUM (
  'mentoria_1k_pyf', 'mentoria_2_5k_pyf', 'mentoria_2_8k_pyf',
  'mentoria_5k', 'skool', 'vip_5k', 'mentoria_2_5k_cuotas',
  'mentoria_5k_cuotas', 'mentoria_1k_cuotas', 'mentoria_fee',
  'cuota_vip_mantencion'
);

CREATE TYPE concepto_pago AS ENUM ('pif', 'fee', 'primera_cuota', 'segunda_cuota');

CREATE TYPE plan_pago AS ENUM ('paid_in_full', '2_cuotas', '3_cuotas', 'personalizado');

CREATE TYPE payment_estado AS ENUM ('pendiente', 'pagado', 'perdido');

CREATE TYPE metodo_pago AS ENUM (
  'binance', 'transferencia', 'caja_ahorro_usd', 'link_mp',
  'cash', 'uruguayos', 'link_stripe'
);

CREATE TYPE moneda AS ENUM ('ars', 'usd');

CREATE TYPE client_estado AS ENUM (
  'activo', 'pausado', 'inactivo', 'solo_skool', 'no_termino_pagar'
);

CREATE TYPE semana_estado AS ENUM (
  'primeras_publicaciones', 'primera_venta', 'escalando_anuncios'
);

CREATE TYPE seguimiento_estado AS ENUM (
  'para_seguimiento', 'no_necesita', 'seguimiento_urgente'
);

CREATE TYPE contacto_estado AS ENUM (
  'por_contactar', 'contactado', 'respondio_renueva', 'respondio_debe_cuota',
  'es_socio', 'no_renueva', 'no_responde', 'numero_invalido',
  'retirar_acceso', 'verificar'
);

CREATE TYPE tipo_renovacion AS ENUM (
  'resell', 'upsell_vip', 'upsell_meli',
  'upsell_vip_cuotas', 'upsell_meli_cuotas', 'resell_cuotas'
);

CREATE TYPE renovacion_estado AS ENUM ('pago', 'no_renueva', 'cuota_1_pagada', 'cuota_2_pagada');

CREATE TYPE origen_cliente AS ENUM (
  'skool_ig', 'solo_skool', 'registro_normal', 'grupo_wa_esa', 'grupo_ig_ecom'
);

CREATE TYPE canal_contacto AS ENUM ('whatsapp', 'instagram_dm', 'email_skool', 'buscar');

CREATE TYPE prioridad_contacto AS ENUM (
  'a_wa_sin_nombre', 'b_ig_solo_username', 'c_solo_skool', 'd_nombre_parcial'
);

CREATE TYPE categoria_cliente AS ENUM (
  'activo_ok', 'cuotas_pendientes', 'deudor', 'solo_skool_verificar',
  'solo_wa_verificar', 'solo_ig_verificar', 'con_pagos_sin_skool',
  'por_verificar', 'equipo_lauty'
);

CREATE TYPE session_tipo AS ENUM (
  'estrategia_inicial', 'revision_ajuste', 'cierre_ciclo', 'adicional'
);

CREATE TYPE session_estado AS ENUM ('programada', 'done', 'cancelada_no_asistio');

CREATE TYPE etapa_ecommerce AS ENUM (
  'cero', 'experiencia_sin_resultados', 'experiencia_escalar'
);

CREATE TYPE agent_task_tipo AS ENUM (
  'cobrar_cuota', 'renovacion', 'seguimiento', 'oportunidad_upsell',
  'bienvenida', 'seguimiento_urgente', 'confirmar_pago'
);

CREATE TYPE agent_task_estado AS ENUM ('pending', 'in_progress', 'done', 'failed');

CREATE TYPE agent_asignacion AS ENUM ('agent', 'human');

CREATE TYPE canal_agente AS ENUM ('whatsapp', 'email', 'dm_instagram');

CREATE TYPE followup_tipo AS ENUM ('llamada', 'whatsapp', 'dm', 'email', 'presencial');
