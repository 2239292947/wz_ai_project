import { readFileContent } from './src/lib/file-reader';
import * as fs from 'fs';

(async () => {
  const buffer = fs.readFileSync('C:/Users/Administrator/Desktop/AIK/demos/黔寨寨贵州烙锅（鞍山店）常温.pdf');
  const rawData = await readFileContent(buffer, 'test.pdf', '');
  const sheetData = rawData['default'];
  for (let i = 45; i < sheetData.length; i++) {
    console.log('Row ' + i + ':', JSON.stringify(sheetData[i].slice(0, 10)));
  }
})();
