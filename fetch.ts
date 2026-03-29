import fs from 'fs';

async function fetchCSV() {
  const url = 'https://docs.google.com/spreadsheets/d/1DitIlALFPxnugFLLwxpSEOpEs1FS6H5ewVCj4ne2jZY/export?format=csv';
  const response = await fetch(url);
  const text = await response.text();
  console.log(text.substring(0, 1000));
}

fetchCSV();
