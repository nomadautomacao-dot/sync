import { describe, expect, it } from 'vitest';
import { validarReceitasPublicadas } from './fundeb-publicacoes';

const rows=Array.from({length:5000},(_,i)=>`CE;${2300000+i};Município;100,00;20,00;3,00;-;;123,00`);
const csv=(values=rows)=>['Receita total do Fundeb 2026',...values].join('\n');

describe('Validação da publicação antes de substituir a base local',()=>{
  it('concilia componentes e preserva zero explícito',()=>{
    const parsed=validarReceitasPublicadas(csv(),2026);
    expect(parsed.size).toBe(5000);
    expect(parsed.get('2300000')).toEqual([100,20,3,0,123]);
  });
  it('rejeita ano incorreto e cobertura incompleta',()=>{
    expect(()=>validarReceitasPublicadas(csv(),2025)).toThrow('competência');
    expect(()=>validarReceitasPublicadas(csv(rows.slice(0,4999)),2026)).toThrow('Cobertura');
  });
  it.each([
    rows[0].replace('100,00','101,00'),
    rows[0].replace(';-;;',';;;'),
    rows[0].replace('3,00;-;;123,00','-3,00;6,00;;123,00'),
    rows[1],
  ])('recusa soma divergente, campo vazio, negativo ou município duplicado',row=>{
    expect(()=>validarReceitasPublicadas(csv([row,...rows.slice(1)]),2026)).toThrow('conciliação');
  });
});
