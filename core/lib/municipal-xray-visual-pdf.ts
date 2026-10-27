import { chromium } from 'playwright';
import { assertSemCorte } from './pdf-corte';

export async function generateMunicipalXrayVisualPdf(html:string, expected:number) {
 const browser=await chromium.launch({args:['--no-sandbox','--disable-setuid-sandbox']});
 try {
  const page=await browser.newPage();await page.emulateMedia({media:'print'});await page.setContent(html,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
  if(await page.locator('section.page').count()!==expected)throw new Error('Edição visual com seções incompletas.');
  await assertSemCorte(page,'Raio-X visual');
  const pdfBuffer=Buffer.from(await page.pdf({preferCSSPageSize:true,printBackground:true}));
  const pages=(pdfBuffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g)??[]).length;
  if(pages!==expected)throw new Error(`Paginação visual divergente: ${pages}/${expected}.`);
  return {pdfBuffer,pages};
 }finally{await browser.close()}
}
