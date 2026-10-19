import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import {
  fetchCarteleraHorarios,
  CARTELERA_DIRECT_URL,
  type ScheduleRow,
} from './lib/cartelera';

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

async function main() {
  const args = process.argv.slice(2);
  const todayBA = getBuenosAiresDatePlusDays(0);
  const endOfWeekBA = getBuenosAiresDatePlusDays(7);

  const fechaInicio = args.find((a) => !a.startsWith('--')) || todayBA;
  const fechaFin =
    args.filter((a) => !a.startsWith('--'))[1] || endOfWeekBA;

  console.log(
    `Consultando fuente oficial: ${CARTELERA_DIRECT_URL} (${fechaInicio} a ${fechaFin})...`
  );

  const result = await fetchCarteleraHorarios({
    baseUrl: CARTELERA_DIRECT_URL,
    fechaInicio,
    fechaFin,
    modo: 'normal',
  });

  console.log(
    `Fuente: ${result.source} | Total registros obtenidos: ${result.totalItems} | Generado: ${result.generatedAt}`
  );
  if (result.debug) {
    console.log('Diagnóstico DB:', result.debug);
  }

  // Asegurar directorio public/
  const publicDir = path.resolve(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const jsonPath = path.join(publicDir, 'horarios.json');
  const csvPath = path.join(publicDir, 'horarios.csv');

  // Filtramos cualquier registro con origen_db === 'sql_server'
  const mergedRows: ScheduleRow[] = result.rows.filter(
    (r) => r.origen_db !== 'sql_server'
  );

  // Ordenar de manera determinística para evitar diffs innecesarios en Git
  mergedRows.sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
    if (a.horario_ini !== b.horario_ini)
      return a.horario_ini.localeCompare(b.horario_ini);
    if (a.carrera !== b.carrera) return a.carrera.localeCompare(b.carrera);
    if (a.actividad_completa !== b.actividad_completa)
      return a.actividad_completa.localeCompare(b.actividad_completa);
    return a.aula.localeCompare(b.aula);
  });

  const sqlCount = mergedRows.filter((r) => r.origen_db === 'sql_server').length;
  const pgCount = mergedRows.filter((r) => r.origen_db === 'postgresql').length;
  const virtualCount = mergedRows.filter((r) => r.es_clase_virtual).length;
  console.log(
    `Desglose consolidado -> Total: ${mergedRows.length} | SQL Server: ${sqlCount} | PostgreSQL (SIU Guaraní): ${pgCount} | Virtuales: ${virtualCount}`
  );

  const payload = {
    ok: true,
    generatedAt: result.generatedAt || new Date().toISOString(),
    source: result.source,
    totalItems: mergedRows.length,
    rows: mergedRows,
  };

  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`✅ Guardado JSON en: ${jsonPath}`);

  const csvContent = Papa.unparse(mergedRows);
  fs.writeFileSync(csvPath, csvContent, 'utf-8');
  console.log(`✅ Guardado CSV en: ${csvPath}`);
}

main().catch((err) => {
  console.error('Error al sincronizar la Cartelera:', err);
  process.exit(1);
});
