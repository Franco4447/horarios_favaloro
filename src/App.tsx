import { useEffect, useState, useMemo, useCallback } from 'react';
import Papa from 'papaparse';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  BookOpen,
  FilterX,
  RefreshCw,
  Video,
  Database,
  Hash,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  fetchHorariosConsolidados,
  normalizarAnio,
  type ScheduleRow,
} from '@/lib/cartelera';

const LEGACY_CSV_URL =
  'https://docs.google.com/spreadsheets/d/1DitIlALFPxnugFLLwxpSEOpEs1FS6H5ewVCj4ne2jZY/export?format=csv';

function getBuenosAiresDatePlusDays(daysOffset = 0): string {
  const target = new Date(Date.now() + daysOffset * 86400000);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(target);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

const STORAGE_KEY = 'horarios_favaloro_filters_v1';

interface SavedFilters {
  turno?: string;
  carrera?: string;
  año?: string;
  modalidad?: string;
  comision?: string;
  search?: string;
  origen?: string;
}

function loadSavedFilters(): SavedFilters {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default function App() {
  const [data, setData] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSourceLabel, setDataSourceLabel] = useState<string>('API Oficial Cartelera UF');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const todayBA = useMemo(() => getBuenosAiresDatePlusDays(0), []);
  const endOfWeekBA = useMemo(() => getBuenosAiresDatePlusDays(7), []);
  const initialSaved = useMemo(() => loadSavedFilters(), []);

  // Filters: Fecha siempre inicia en "hoy" (todayBA); Origen por defecto es "sql_server" (Interno)
  const [filterFecha, setFilterFecha] = useState<string>(() => getBuenosAiresDatePlusDays(0));
  const [filterTurno, setFilterTurno] = useState<string>(() => initialSaved.turno || '');
  const [filterCarrera, setFilterCarrera] = useState<string>(() => initialSaved.carrera || '');
  const [filterAño, setFilterAño] = useState<string>(() => initialSaved.año || '');
  const [filterModalidad, setFilterModalidad] = useState<string>(
    () => initialSaved.modalidad || ''
  );
  const [filterComision, setFilterComision] = useState<string>(() => initialSaved.comision || '');
  const [searchQuery, setSearchQuery] = useState<string>(() => initialSaved.search || '');
  const [filterOrigen, setFilterOrigen] = useState<string>(() =>
    initialSaved.origen === 'postgresql' || initialSaved.origen === 'sql_server'
      ? initialSaved.origen
      : 'sql_server'
  );

  // Persistir selección de filtros del usuario en su navegador
  useEffect(() => {
    try {
      const toSave: SavedFilters = {
        turno: filterTurno,
        carrera: filterCarrera,
        año: filterAño,
        modalidad: filterModalidad,
        comision: filterComision,
        search: searchQuery,
        origen: filterOrigen,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // Ignorar errores de almacenamiento (modo incógnito restringido, etc.)
    }
  }, [
    filterTurno,
    filterCarrera,
    filterAño,
    filterModalidad,
    filterComision,
    searchQuery,
    filterOrigen,
  ]);

  const loadSchedule = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Consultar horarios consolidados (Proxy en vivo -> GitHub Actions JSON -> Local JSON)
      const result = await fetchHorariosConsolidados({
        fechaInicio: todayBA,
        fechaFin: endOfWeekBA,
        modo: 'normal',
      });

      setData(result.rows);
      const labelMap = {
        live_api: `Cartelera UF en vivo (${result.source})`,
        github_json: `GitHub Sync (${result.source})`,
        local_json: `Snapshot Local (${result.source})`,
      };
      setDataSourceLabel(labelMap[result.originType]);
      setLastUpdated(
        result.generatedAt
          ? new Date(result.generatedAt).toLocaleString('es-AR', {
              timeZone: 'America/Argentina/Buenos_Aires',
              hour12: false,
            })
          : new Date().toLocaleString('es-AR', {
              timeZone: 'America/Argentina/Buenos_Aires',
              hour12: false,
            })
      );
      setLoading(false);
    } catch (apiErr: any) {
      console.warn(
        'No se pudo conectar directo al proxy de la API oficial, usando respaldo CSV:',
        apiErr
      );
      try {
        const response = await fetch(LEGACY_CSV_URL);
        if (!response.ok) throw new Error('Error al cargar respaldo CSV');
        const csvText = await response.text();

        Papa.parse<any>(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const normalizedFallback: ScheduleRow[] = results.data.map((r: any) => ({
              fecha: r.fecha || '',
              año: normalizarAnio(r.año),
              carrera: r.carrera || '',
              actividad: r.actividad || '',
              actividad_completa: r.actividad || '',
              comision: '',
              id_comision: '',
              horario: r.horario || '',
              horario_ini: (r.horario || '').split(' - ')[0] || '',
              horario_fin: (r.horario || '').split(' - ')[1] || '',
              turno: r.turno || '',
              ubicacion: r.ubicacion || '',
              aula: r.aula || '',
              docente: r.docente || '',
              dia_semana: r.dia_semana || '',
              observacion: r.observacion || '',
              es_clase_virtual: false,
              origen_db: 'csv_fallback',
              insert_ts: r.insert_ts || '',
            }));
            setData(normalizedFallback);
            setDataSourceLabel('Respaldo Google Sheets (Desactualizado)');
            setLastUpdated(normalizedFallback[0]?.insert_ts || null);
            setLoading(false);
          },
          error: (err: any) => {
            setError(err.message);
            setLoading(false);
          },
        });
      } catch (fallbackErr: any) {
        setError(apiErr?.message || fallbackErr?.message || 'Error al cargar horarios');
        setLoading(false);
      }
    }
  }, [todayBA, endOfWeekBA]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  // Compute unique values for filters
  const uniqueTurnos = useMemo(
    () => Array.from(new Set(data.map((d) => d.turno).filter(Boolean))).sort(),
    [data]
  );
  const uniqueFechas = useMemo(
    () =>
      Array.from(new Set([todayBA, ...data.map((d) => d.fecha).filter(Boolean)])).sort(),
    [data, todayBA]
  );
  const uniqueCarreras = useMemo(
    () => Array.from(new Set(data.map((d) => d.carrera).filter(Boolean))).sort(),
    [data]
  );
  const uniqueAños = useMemo(
    () => Array.from(new Set(data.map((d) => d.año).filter(Boolean))).sort(),
    [data]
  );

  // Filter and sort data
  const filteredData = useMemo(() => {
    return data
      .filter((row) => {
        const matchTurno = filterTurno ? row.turno === filterTurno : true;
        const matchFecha = filterFecha ? row.fecha === filterFecha : true;
        const matchCarrera = filterCarrera ? row.carrera === filterCarrera : true;
        const matchAño = filterAño ? row.año === filterAño : true;
        const matchModalidad =
          filterModalidad === 'virtual'
            ? row.es_clase_virtual
            : filterModalidad === 'presencial'
              ? !row.es_clase_virtual
              : true;

        const matchOrigen = filterOrigen ? row.origen_db === filterOrigen : true;

        const comisionLower = filterComision.trim().toLowerCase();
        const matchComision = comisionLower
          ? row.comision.toLowerCase().includes(comisionLower) ||
            row.id_comision.toLowerCase().includes(comisionLower)
          : true;

        const searchLower = searchQuery.toLowerCase();
        const matchSearch = searchQuery
          ? row.actividad?.toLowerCase().includes(searchLower) ||
            row.actividad_completa?.toLowerCase().includes(searchLower) ||
            row.docente?.toLowerCase().includes(searchLower) ||
            row.ubicacion?.toLowerCase().includes(searchLower) ||
            row.aula?.toLowerCase().includes(searchLower) ||
            row.observacion?.toLowerCase().includes(searchLower)
          : true;

        return (
          matchTurno &&
          matchFecha &&
          matchCarrera &&
          matchAño &&
          matchModalidad &&
          matchComision &&
          matchSearch &&
          matchOrigen
        );
      })
      .sort((a, b) => {
        if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
        if (a.horario_ini !== b.horario_ini) return a.horario_ini.localeCompare(b.horario_ini);
        return a.carrera.localeCompare(b.carrera);
      });
  }, [
    data,
    filterTurno,
    filterFecha,
    filterCarrera,
    filterAño,
    filterModalidad,
    filterComision,
    searchQuery,
    filterOrigen,
  ]);

  const clearFilters = () => {
    setFilterTurno('');
    setFilterFecha(todayBA);
    setFilterCarrera('');
    setFilterAño('');
    setFilterModalidad('');
    setFilterComision('');
    setSearchQuery('');
    setFilterOrigen('sql_server');
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted-foreground font-medium">
            Cargando horarios desde Cartelera Favaloro...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
        <Card className="w-full max-w-md border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error al cargar datos</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={loadSchedule} variant="outline" className="w-full">
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Horarios Universidad Favaloro (no oficial)
            </h1>
            <p className="text-slate-500 mt-1">
              Consulta y filtra en vivo la Cartelera de Cursos de Universidad Favaloro (Interno +
              SIU Guaraní).
            </p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="w-fit text-sm px-3 py-1">
                {filteredData.length}{' '}
                {filteredData.length === 1 ? 'clase encontrada' : 'clases encontradas'}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={loadSchedule}
                className="gap-1.5 text-slate-700"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Actualizar
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="w-fit text-xs font-normal text-emerald-700 bg-emerald-50 border-emerald-200 flex items-center gap-1"
              >
                <Database className="w-3 h-3" />
                {dataSourceLabel}
              </Badge>
              {lastUpdated && (
                <Badge
                  variant="outline"
                  className="w-fit text-xs font-normal text-slate-500 bg-slate-50"
                >
                  Actualizado: {lastUpdated}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <FilterX className="w-5 h-5 text-slate-500" />
              Filtros de Búsqueda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fecha">Fecha</Label>
                <select
                  id="fecha"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={filterFecha}
                  onChange={(e) => setFilterFecha(e.target.value)}
                >
                  <option value="">Todas las fechas</option>
                  {uniqueFechas.map((f) => (
                    <option key={f} value={f}>
                      {f === todayBA ? `${f} (hoy)` : f}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="carrera">Carrera</Label>
                <select
                  id="carrera"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={filterCarrera}
                  onChange={(e) => setFilterCarrera(e.target.value)}
                >
                  <option value="">Todas las carreras</option>
                  {uniqueCarreras.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="año">Año</Label>
                <select
                  id="año"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={filterAño}
                  onChange={(e) => setFilterAño(e.target.value)}
                >
                  <option value="">Todos los años</option>
                  {uniqueAños.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="turno">Turno</Label>
                <select
                  id="turno"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={filterTurno}
                  onChange={(e) => setFilterTurno(e.target.value)}
                >
                  <option value="">Todos los turnos</option>
                  {uniqueTurnos.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="modalidad">Modalidad</Label>
                <select
                  id="modalidad"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={filterModalidad}
                  onChange={(e) => setFilterModalidad(e.target.value)}
                >
                  <option value="">Todas (Presencial + Virtual)</option>
                  <option value="presencial">Solo Presencial</option>
                  <option value="virtual">Solo Virtual</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="comision">Comisión</Label>
                <Input
                  id="comision"
                  placeholder="Ej. 1, FYB, C2..."
                  value={filterComision}
                  onChange={(e) => setFilterComision(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="search">Búsqueda libre</Label>
                <Input
                  id="search"
                  placeholder="Materia, docente, aula..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="origen">Origen</Label>
                <select
                  id="origen"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={filterOrigen}
                  onChange={(e) => setFilterOrigen(e.target.value)}
                >
                  <option value="sql_server">Interno</option>
                  <option value="postgresql">SIU Guaraní</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button variant="outline" size="sm" onClick={clearFilters} className="text-slate-600">
                Limpiar filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-100/50">
                <TableRow>
                  <TableHead className="w-[120px]">Fecha</TableHead>
                  <TableHead className="w-[110px]">Horario</TableHead>
                  <TableHead className="min-w-[220px]">Actividad / Materia</TableHead>
                  <TableHead className="min-w-[160px]">Carrera & Año</TableHead>
                  <TableHead className="min-w-[180px]">Docente / Responsable</TableHead>
                  <TableHead className="min-w-[170px]">Ubicación & Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                      No se encontraron clases con los filtros seleccionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((row, i) => (
                    <TableRow key={i} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span className="whitespace-nowrap">{row.fecha}</span>
                        </div>
                        <div className="text-xs text-slate-500 ml-6">{row.dia_semana}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span className="whitespace-nowrap">{row.horario}</span>
                        </div>
                        <div className="text-xs text-slate-500 ml-6">{row.turno}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-slate-900">{row.actividad}</span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {row.comision && (
                              <span className="inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                <Hash className="w-3 h-3 text-slate-400" />
                                Com: {row.comision}
                              </span>
                            )}
                            {row.origen_db === 'postgresql' ? (
                              <span className="text-[11px] text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                                SIU Guaraní
                              </span>
                            ) : row.origen_db === 'sql_server' ? (
                              <span className="text-[11px] text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                                Interno
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <span className="text-sm font-medium text-slate-700">
                              {row.carrera}
                            </span>
                          </div>
                          {row.año && (
                            <Badge
                              variant="outline"
                              className="w-fit text-xs font-normal text-slate-600 bg-slate-50"
                            >
                              {row.año}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="text-sm text-slate-700">{row.docente || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            {row.es_clase_virtual ? (
                              <Video className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                            ) : (
                              <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            )}
                            <span className="text-sm font-medium text-slate-700">
                              {row.ubicacion || '-'}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 ml-5">
                            Aula: {row.aula || '-'}
                          </span>
                          {row.observacion && (
                            <span
                              className={`text-xs px-2 py-0.5 rounded-md w-fit border ml-5 mt-1 ${
                                row.es_clase_virtual
                                  ? 'text-sky-700 bg-sky-50 border-sky-200'
                                  : 'text-amber-700 bg-amber-50 border-amber-200'
                              }`}
                            >
                              {row.observacion}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        <footer className="pt-4 pb-6 flex flex-wrap items-center justify-center gap-2.5 text-sm text-slate-500">
          <span>
            Desarrollado por{' '}
            <strong className="font-medium text-slate-700">Franco Méndez Casariego</strong>
          </span>
          <a
            href="https://www.linkedin.com/in/francomendezc"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white text-slate-700 border border-slate-200 shadow-xs transition-all duration-200 hover:bg-[#0A66C2] hover:text-white hover:border-[#0A66C2] hover:shadow-sm"
            aria-label="Perfil de LinkedIn de Franco Méndez Casariego"
          >
            <svg
              className="w-3.5 h-3.5 fill-current"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
            </svg>
            <span>LinkedIn</span>
          </a>
        </footer>
      </div>
    </div>
  );
}
