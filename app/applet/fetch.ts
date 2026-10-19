import { fetchCarteleraHorarios, CARTELERA_DIRECT_URL } from '../../lib/cartelera';

async function fetchCartelera() {
  const result = await fetchCarteleraHorarios({
    baseUrl: CARTELERA_DIRECT_URL,
    modo: 'normal',
  });
  console.log(`Total clases obtenidas: ${result.totalItems} (fuente: ${result.source})`);
  console.log(JSON.stringify(result.rows.slice(0, 5), null, 2));
}

fetchCartelera();
