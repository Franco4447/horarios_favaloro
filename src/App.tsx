import { useEffect, useState, useMemo } from 'react';
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
import { Calendar, Clock, MapPin, User, BookOpen, FilterX } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ScheduleRow {
  fecha: string;
  año: string;
  carrera: string;
  actividad: string;
  horario: string;
  turno: string;
  ubicacion: string;
  aula: string;
  docente: string;
  dia_semana: string;
  observacion: string;
  insert_ts: string;
}

const CSV_URL = 'https://docs.google.com/spreadsheets/d/1DitIlALFPxnugFLLwxpSEOpEs1FS6H5ewVCj4ne2jZY/export?format=csv';

export default function App() {
  const [data, setData] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterTurno, setFilterTurno] = useState<string>('');
  const [filterFecha, setFilterFecha] = useState<string>('');
  const [filterCarrera, setFilterCarrera] = useState<string>('');
  const [filterAño, setFilterAño] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(CSV_URL);
        if (!response.ok) throw new Error('Failed to fetch data');
        const csvText = await response.text();
        
        Papa.parse<ScheduleRow>(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            setData(results.data);
            setLoading(false);
          },
          error: (err: any) => {
            setError(err.message);
            setLoading(false);
          }
        });
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Compute unique values for filters
  const uniqueTurnos = useMemo(() => Array.from(new Set(data.map(d => d.turno).filter(Boolean))).sort(), [data]);
  const uniqueFechas = useMemo(() => Array.from(new Set(data.map(d => d.fecha).filter(Boolean))).sort(), [data]);
  const uniqueCarreras = useMemo(() => Array.from(new Set(data.map(d => d.carrera).filter(Boolean))).sort(), [data]);
  const uniqueAños = useMemo(() => Array.from(new Set(data.map(d => d.año).filter(Boolean))).sort(), [data]);

  // Get today's date in Buenos Aires timezone
  const todayBA = useMemo(() => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(new Date());
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    return `${year}-${month}-${day}`;
  }, []);

  // Filter data
  const filteredData = useMemo(() => {
    return data.filter(row => {
      const matchTurno = filterTurno ? row.turno === filterTurno : true;
      const matchFecha = filterFecha ? row.fecha === filterFecha : true;
      const matchCarrera = filterCarrera ? row.carrera === filterCarrera : true;
      const matchAño = filterAño ? row.año === filterAño : true;
      
      const searchLower = searchQuery.toLowerCase();
      const matchSearch = searchQuery ? (
        (row.actividad?.toLowerCase().includes(searchLower)) ||
        (row.docente?.toLowerCase().includes(searchLower)) ||
        (row.ubicacion?.toLowerCase().includes(searchLower)) ||
        (row.aula?.toLowerCase().includes(searchLower))
      ) : true;

      return matchTurno && matchFecha && matchCarrera && matchAño && matchSearch;
    });
  }, [data, filterTurno, filterFecha, filterCarrera, filterAño, searchQuery]);

  const clearFilters = () => {
    setFilterTurno('');
    setFilterFecha('');
    setFilterCarrera('');
    setFilterAño('');
    setSearchQuery('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted-foreground font-medium">Cargando horarios...</p>
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
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Horarios de Facultad</h1>
            <p className="text-slate-500 mt-1">Consulta y filtra los horarios de clases, docentes y aulas.</p>
          </div>
          <Badge variant="secondary" className="w-fit text-sm px-3 py-1">
            {filteredData.length} {filteredData.length === 1 ? 'clase encontrada' : 'clases encontradas'}
          </Badge>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <FilterX className="w-5 h-5 text-slate-500" />
              Filtros de Búsqueda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              
              <div className="space-y-2">
                <Label htmlFor="fecha">Fecha</Label>
                <select 
                  id="fecha"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={filterFecha}
                  onChange={(e) => setFilterFecha(e.target.value)}
                >
                  <option value="">Todas las fechas</option>
                  {uniqueFechas.map(f => (
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
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={filterCarrera}
                  onChange={(e) => setFilterCarrera(e.target.value)}
                >
                  <option value="">Todas las carreras</option>
                  {uniqueCarreras.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="año">Año</Label>
                <select 
                  id="año"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={filterAño}
                  onChange={(e) => setFilterAño(e.target.value)}
                >
                  <option value="">Todos los años</option>
                  {uniqueAños.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="turno">Turno</Label>
                <select 
                  id="turno"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={filterTurno}
                  onChange={(e) => setFilterTurno(e.target.value)}
                >
                  <option value="">Todos los turnos</option>
                  {uniqueTurnos.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
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
                  <TableHead className="w-[100px]">Horario</TableHead>
                  <TableHead className="min-w-[200px]">Actividad / Materia</TableHead>
                  <TableHead className="min-w-[150px]">Carrera & Año</TableHead>
                  <TableHead className="min-w-[180px]">Docente</TableHead>
                  <TableHead className="min-w-[150px]">Ubicación</TableHead>
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
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                            <span className="text-sm font-medium text-slate-700">{row.carrera}</span>
                          </div>
                          <Badge variant="outline" className="w-fit text-xs font-normal text-slate-600 bg-slate-50">
                            {row.año}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400" />
                          <span className="text-sm text-slate-700">{row.docente || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-sm font-medium text-slate-700">{row.ubicacion}</span>
                          </div>
                          <span className="text-xs text-slate-500 ml-5">Aula: {row.aula || '-'}</span>
                          {row.observacion && (
                            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md w-fit border border-amber-200 ml-5 mt-1">
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
      </div>
    </div>
  );
}
