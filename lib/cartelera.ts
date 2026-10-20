export interface CarteleraRawItem {
  fecha: string;
  año: string;
  carrera: string;
  actividad: string;
  id_comision: string;
  horario_ini: string;
  horario_fin: string;
  ubicacion: string;
  aula: string;
  detalle_cartelera: string;
  mat_doc: string;
  es_clase_virtual: boolean | number | string;
  propuesta_nombre: string;
  actividad_nombre: string;
  ubicacion_nombre: string;
  comision_nombre: string;
  edificio_nombre: string;
  aula_nombre: string;
  anio_cursada: string;
  dia_semana: string;
  inicio_fin_clase: string;
}

export interface CarteleraApiResponse {
  ok: boolean;
  items: CarteleraRawItem[];
  totalItems: number;
  totalPages: number;
  pageNumber: number;
  pageSize: number;
  source?: string;
  params?: {
    fecha_inicio: string;
    fecha_fin: string;
    idCartelera: string | number | null;
    id_carrera: string | number | null;
    estimado: number | null;
    modo: string;
    sp: string;
  };
  generatedAt?: string;
  debug?: {
    error_postgresql: string | null;
    error_sql_server: string | null;
    virtuales_ocultas_en_tv: number;
    finalizadas_ocultas_en_tv: number;
    tolerancia_tv_minutos: number;
    hora_referencia_tv: string | null;
  };
}

export interface ScheduleRow {
  fecha: string;
  año: string;
  carrera: string;
  actividad: string;
  actividad_completa: string;
  comision: string;
  id_comision: string;
  horario: string;
  horario_ini: string;
  horario_fin: string;
  turno: string;
  ubicacion: string;
  aula: string;
  docente: string;
  dia_semana: string;
  observacion: string;
  es_clase_virtual: boolean;
  origen_db: 'sql_server' | 'postgresql' | 'csv_fallback';
  insert_ts: string;
}

export const CARTELERA_DIRECT_URL = 'https://cartelera.favaloro.edu.ar:20120/api/cartelera.php';
export const CARTELERA_PROXY_URL = '/api/cartelera.php';

/**
 * Detecta si una clase es virtual siguiendo la misma regla que la Cartelera oficial.
 */
export function esItemClaseVirtual(item: Partial<CarteleraRawItem>): boolean {
  const marca = item.es_clase_virtual;
  if (marca === true || marca === 1 || marca === '1' || marca === 'true') {
    return true;
  }
  const campos = [
    item.ubicacion,
    item.aula,
    item.ubicacion_nombre,
    item.edificio_nombre,
    item.aula_nombre,
  ];
  return campos.some((val) =>
    (val ?? '').toString().trimStart().toLowerCase().startsWith('z_')
  );
}

/**
 * Unifica el formato de año entre SQL Server ("1º año") y PostgreSQL/SIU Guaraní ("1 AÑO").
 */
export function normalizarAnio(rawAnio?: string): string {
  const limpio = (rawAnio ?? '').trim();
  if (!limpio) return '';
  const match = limpio.match(/^(\d+)\s*(?:º|°|er|do|to|ro)?\s*a[ñn]o$/i);
  if (match) {
    return `${match[1]}º año`;
  }
  return limpio;
}

/**
 * Obtiene el nombre del día de la semana en español con tildes correctas a partir de YYYY-MM-DD.
 */
export function obtenerDiaSemana(fechaIso: string): string {
  if (!fechaIso) return '';
  const rawDate = fechaIso.split('T')[0];
  const date = new Date(`${rawDate}T12:00:00`);
  if (isNaN(date.getTime())) return '';
  const dia = date.toLocaleDateString('es-AR', { weekday: 'long' });
  return dia.charAt(0).toUpperCase() + dia.slice(1).toLowerCase();
}

/**
 * Calcula el turno ("Turno Mañana" o "Turno Vespertino") según horario de inicio.
 */
export function calcularTurno(horarioIni: string): string {
  const limpio = (horarioIni || '').trim();
  if (!limpio) return '';
  return limpio < '15:00' ? 'Turno Mañana' : 'Turno Vespertino';
}

/**
 * Limpia prefijos redundantes en el nombre de la actividad (ej. "- HUFF - ..." o "2º año - ...").
 */
export function limpiarNombreActividad(item: CarteleraRawItem): string {
  const base = (item.actividad_nombre || item.actividad || '').trim();
  return base
    .replace(/^-\s*/, '')
    .replace(/^\d+\s*(?:º|°)?\s*a[ñn]o\s*-\s*/i, '')
    .trim();
}

/**
 * Normaliza un registro crudo de api/cartelera.php al formato unificado ScheduleRow.
 */
export function normalizarItemCartelera(
  item: CarteleraRawItem,
  generatedAt?: string
): ScheduleRow {
  const fecha = (item.fecha || '').split('T')[0];
  const virtual = esItemClaseVirtual(item);
  const horarioIni = (item.horario_ini || '').trim();
  const horarioFin = (item.horario_fin || '').trim();
  const horario =
    item.inicio_fin_clase?.trim() ||
    (horarioIni && horarioFin ? `${horarioIni} - ${horarioFin}` : horarioIni || horarioFin);

  const detalle = virtual
    ? item.detalle_cartelera?.trim() || 'Clase virtual'
    : (item.detalle_cartelera || '').trim();

  // En multi_db, los registros de PostgreSQL (SIU Guaraní) traen dia_semana poblado de origen
  // y año en formato "1 AÑO", mientras SQL Server trae dia_semana === "".
  const origenDb: 'sql_server' | 'postgresql' =
    item.dia_semana && item.dia_semana.trim() !== '' ? 'postgresql' : 'sql_server';

  const comisionLimpia =
    item.comision_nombre && item.comision_nombre !== item.id_comision
      ? `${item.comision_nombre} (#${item.id_comision})`
      : item.id_comision || '';

  return {
    fecha,
    año: normalizarAnio(item.año || item.anio_cursada),
    carrera: (item.carrera || item.propuesta_nombre || 'SIN CARRERA').trim(),
    actividad: limpiarNombreActividad(item),
    actividad_completa: (item.actividad || '').trim(),
    comision: comisionLimpia,
    id_comision: (item.id_comision || '').toString().trim(),
    horario,
    horario_ini: horarioIni,
    horario_fin: horarioFin,
    turno: calcularTurno(horarioIni),
    ubicacion: (item.ubicacion || item.edificio_nombre || (virtual ? 'Virtual (Zoom)' : '')).trim(),
    aula: (item.aula || item.aula_nombre || '').trim(),
    docente: (item.mat_doc || '').trim(),
    dia_semana: obtenerDiaSemana(fecha) || item.dia_semana || '',
    observacion: detalle,
    es_clase_virtual: virtual,
    origen_db: origenDb,
    insert_ts: generatedAt
      ? new Date(generatedAt).toLocaleString('es-AR', {
          timeZone: 'America/Argentina/Buenos_Aires',
          hour12: false,
        })
      : '',
  };
}

export interface FetchCarteleraOptions {
  baseUrl?: string;
  fechaInicio?: string;
  fechaFin?: string;
  modo?: 'normal' | 'tv';
  pageSize?: number;
}

export interface FetchCarteleraResult {
  rows: ScheduleRow[];
  totalItems: number;
  generatedAt: string;
  source: string;
  debug?: CarteleraApiResponse['debug'];
}

/**
 * Obtiene todas las páginas de la API oficial de Cartelera Favaloro y devuelve todas las filas normalizadas.
 */
export async function fetchCarteleraHorarios(
  options: FetchCarteleraOptions = {}
): Promise<FetchCarteleraResult> {
  const {
    baseUrl = typeof window !== 'undefined' ? CARTELERA_PROXY_URL : CARTELERA_DIRECT_URL,
    fechaInicio,
    fechaFin,
    modo = 'normal',
    pageSize = 500,
  } = options;

  let currentPage = 1;
  let totalPages = 1;
  const allRawItems: CarteleraRawItem[] = [];
  let generatedAt = '';
  let source = 'multi_db';
  let debugInfo: CarteleraApiResponse['debug'] = undefined;

  do {
    const params = new URLSearchParams({
      pageNumber: String(currentPage),
      pageSize: String(pageSize),
      modo,
      debug: '1',
      _ts: String(Date.now()),
    });

    if (fechaInicio) params.set('fecha_inicio', fechaInicio);
    if (fechaFin) params.set('fecha_fin', fechaFin);

    const response = await fetch(`${baseUrl}?${params.toString()}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status} al consultar Cartelera Favaloro`);
    }

    const data: CarteleraApiResponse = await response.json();
    if (!data?.ok) {
      throw new Error('La API de Cartelera devolvió una respuesta inválida (ok=false)');
    }

    if (Array.isArray(data.items)) {
      allRawItems.push(...data.items);
    }

    totalPages = Number(data.totalPages) || 1;
    generatedAt = data.generatedAt || generatedAt;
    source = data.source || source;
    debugInfo = data.debug || debugInfo;
    currentPage++;
  } while (currentPage <= totalPages);

  const rows = allRawItems.map((item) => normalizarItemCartelera(item, generatedAt));

  return {
    rows,
    totalItems: rows.length,
    generatedAt,
    source,
    debug: debugInfo,
  };
}

export const GITHUB_RAW_JSON_URL =
  'https://raw.githubusercontent.com/Franco4447/horarios_favaloro/main/public/horarios.json';
export const LOCAL_STATIC_JSON_URL = './horarios.json';

/**
 * Carga los horarios probando en cascada:
 * 1. API en vivo (vía proxy Vite en local)
 * 2. JSON actualizado por GitHub Actions en el repositorio (raw.githubusercontent.com)
 * 3. JSON estático empaquetado en public/horarios.json
 */
export async function fetchHorariosConsolidados(
  options: FetchCarteleraOptions = {}
): Promise<FetchCarteleraResult & { originType: 'live_api' | 'github_json' | 'local_json' }> {
  // 1. Intentar API en vivo si estamos en entorno con proxy activo
  try {
    const liveResult = await fetchCarteleraHorarios(options);
    if (liveResult.rows.length > 0) {
      return { ...liveResult, originType: 'live_api' };
    }
  } catch {
    // Continúa al JSON de GitHub Actions / local
  }

  // 2. Intentar JSON desde GitHub Raw (siempre refleja el último commit de GitHub Actions)
  try {
    const ghRes = await fetch(`${GITHUB_RAW_JSON_URL}?_ts=${Date.now()}`, {
      cache: 'no-store',
    });
    if (ghRes.ok) {
      const ghData = await ghRes.json();
      if (ghData?.ok && Array.isArray(ghData.rows) && ghData.rows.length > 0) {
        return {
          rows: ghData.rows,
          totalItems: ghData.rows.length,
          generatedAt: ghData.generatedAt || '',
          source: ghData.source || 'github_actions',
          originType: 'github_json',
        };
      }
    }
  } catch {
    // Continúa al JSON estático local
  }

  // 3. Intentar JSON estático local (public/horarios.json)
  const localRes = await fetch(`${LOCAL_STATIC_JSON_URL}?_ts=${Date.now()}`, {
    cache: 'no-store',
  });
  if (!localRes.ok) {
    throw new Error('No se pudo obtener public/horarios.json');
  }
  const localData = await localRes.json();
  if (!localData?.ok || !Array.isArray(localData.rows)) {
    throw new Error('Formato inválido en horarios.json');
  }

  return {
    rows: localData.rows,
    totalItems: localData.rows.length,
    generatedAt: localData.generatedAt || '',
    source: localData.source || 'local_json',
    originType: 'local_json',
  };
}

