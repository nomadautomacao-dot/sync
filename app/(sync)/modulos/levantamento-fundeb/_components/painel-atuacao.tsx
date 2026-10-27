'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Flex, Form, Input, InputNumber, Modal, Select, Table, Tabs, Typography } from 'antd';
import { useAuth } from '@/core/providers/auth-provider';
import { getFirebaseDb } from '@/core/lib/firebase-client';
import type { AcaoAtuacao, RaioXAtuacao } from '@/core/lib/raio-x-atuacao';
import { listarAcoes, salvarAcao } from '@/modules/levantamento-fundeb/acompanhamento-firestore';
import { acompanhamentoSchema, acompanhamentoVazio, ESTADOS_ACAO, type Acompanhamento } from '@/modules/levantamento-fundeb/acompanhamento';
import { simularMudancaJornada, type PremissasSimulacao } from '@/core/lib/fundeb-simulacao';

const labels: Record<string, string> = { proposta:'Proposta', em_validacao:'Em validação', aprovada:'Aprovada', em_execucao:'Em execução', concluida:'Entrega concluída', descartada:'Hipótese descartada' };
function baixar(nome: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const csvCell = (v: unknown) => '"' + String(v ?? '').replace(/^[=+\-@]/, "'$&").replace(/"/g, '""') + '"';

export function PainelAtuacao({ codigoIbge, exercicio }: { codigoIbge: string; exercicio: number }) {
  const { user } = useAuth(), { message } = App.useApp(), cache = useQueryClient();
  const [ativo, setAtivo] = useState(false), [acao, setAcao] = useState<AcaoAtuacao | null>(null);
  const [form] = Form.useForm<Acompanhamento>();
  const queryKey = ['atuacao', codigoIbge, exercicio];
  const plano = useQuery({ queryKey, enabled: ativo, queryFn: async () => {
    const response = await fetch('/api/modulos/levantamento-fundeb/raio-x-atuacao', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({codigo_ibge:codigoIbge,exercicio,response_format:'preview'}) });
    if (!response.ok) throw new Error((await response.json()).error ?? 'Falha na consulta.');
    return await response.json() as RaioXAtuacao;
  }, staleTime: 5 * 60_000 });
  const registrosKey = ['acompanhamento-fundeb',user?.groupId,codigoIbge,exercicio];
  const atualizarFontes = useMutation({mutationFn:async()=>{
    const r=await fetch('/api/modulos/levantamento-fundeb/raio-x-atuacao',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({codigo_ibge:codigoIbge,exercicio,response_format:'preview',atualizar:true})});
    if(!r.ok)throw new Error((await r.json()).error??'Falha ao reconsultar fontes.');
    return await r.json() as RaioXAtuacao;
  },onSuccess:data=>{cache.setQueryData(queryKey,data);message.success('Fontes reconsultadas. Confira a cobertura e as ressalvas.');},onError:e=>message.error(e.message)});
  const registros = useQuery({ queryKey: registrosKey, enabled: ativo && Boolean(user?.groupId), queryFn: () => listarAcoes(getFirebaseDb(),user!.groupId,codigoIbge,exercicio) });
  const salvar = useMutation({ mutationFn: async (values:Acompanhamento) => {
    if (!user || !acao || !plano.data) throw new Error('Carregue o plano e entre na sua conta.');
    if (registros.isError || registros.isPending) throw new Error('Aguarde a leitura dos registros salvos; recarregue em caso de erro.');
    const parsed = acompanhamentoSchema.safeParse(values);
    if (!parsed.success) throw new Error(parsed.error.issues.map(x=>x.message).join(' '));
    const old = registros.data?.find(r=>r.acaoId===acao.id);
    await salvarAcao(getFirebaseDb(), {groupId:user.groupId,codigoIbge,exercicio,acaoId:acao.id,titulo:acao.titulo,snapshotId:old?.snapshotId??plano.data.snapshotId,linhaBase:old?.linhaBase??acao.evidencia.descricao,atualizadoPor:user.id,revisao:old?.revisao??0,acompanhamento:parsed.data});
  }, onSuccess:async()=>{await cache.invalidateQueries({queryKey:registrosKey});setAcao(null);message.success('Acompanhamento salvo com histórico.');},onError:e=>message.error(e.message) });
  function editar(a:AcaoAtuacao) {setAcao(a);form.setFieldsValue(registros.data?.find(r=>r.acaoId===a.id)?.acompanhamento??acompanhamentoVazio);}
  const i = plano.data?.inteligencia;
  const exportarEscolas = () => {
    const rows = [['Código INEP','Escola','Matrículas','Base territorial','Base de resultados','Base de indicadores','Conferir recortes','Sinais e anos'], ...(i?.escolas??[]).map(s=>[s.codigo,s.nome,s.matriculas,s.bases.territorio,s.bases.resultados,s.bases.indicadores,s.verificacaoCadastro,s.sinais.map(x=>`${x.indicador}: ${x.valor}; ano ${x.ano}; referência ${x.referencia}`).join(' | ')])];
    baixar(`ESCOLAS_${codigoIbge}_${exercicio}.csv`,'\uFEFF'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n'),'text/csv;charset=utf-8');
  };
  return <Card title="Prioridades e acompanhamento" size="small">
    <Flex vertical gap={14}>
      <Typography.Paragraph>Consulte a execução financeira, os indicadores VAAR e as escolas prioritárias. Registre as entregas da equipe com evidência e mantenha a linha de base.</Typography.Paragraph>
      <Flex gap={8} wrap>
        <Button type="primary" loading={plano.isFetching} onClick={()=>{if(ativo)void plano.refetch();else setAtivo(true);}}>Carregar plano</Button>
        {plano.data && <><Button loading={atualizarFontes.isPending} onClick={()=>atualizarFontes.mutate()}>Reconsultar fontes</Button><Button onClick={()=>baixar(`PLANO_${codigoIbge}_${exercicio}.json`,JSON.stringify({plano:plano.data,acompanhamento:registros.data??[],acompanhamentoDisponivel:registros.isSuccess},null,2))}>Exportar dados e fontes</Button><Button onClick={exportarEscolas}>Exportar escolas</Button></>}
      </Flex>
      {plano.error && <Alert type="error" title={plano.error.message}/>}
      {registros.error && <Alert type="warning" title="Não foi possível ler o acompanhamento salvo. As ações abaixo são propostas; não substituem os registros da equipe." description={registros.error.message}/>}
      {plano.data && <Tabs items={[
        {key:'acoes',label:'Ações',children:<Table size="small" rowKey="id" pagination={false} dataSource={plano.data.acoes} columns={[
          {title:'Prioridade',dataIndex:'prioridade',width:90},{title:'Ação',dataIndex:'titulo'},
          {title:'Situação',render:(_,a)=>labels[registros.data?.find(r=>r.acaoId===a.id)?.acompanhamento.status??'proposta']},
          {title:'Acompanhar',render:(_,a)=><Button size="small" disabled={!user||!registros.isSuccess} onClick={()=>editar(a)}>Registrar</Button>}
        ]}/>},
        {key:'financeiro',label:'Financeiro',children:<Flex vertical gap={10}>
          <Typography.Text>Execução: {i?.financeiro.atual.bimestre || 'N/D'}º bimestre de {exercicio}; cobertura {i?.financeiro.atual.estado??'indisponível'}.</Typography.Text>
          <Typography.Text>Transferências do Fundeb declaradas: {i?.financeiro.atual.receitaFundeb?.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})??'Não disponível'}.</Typography.Text>
          <Alert type="info" title={i?.financeiro.nota??'Sem dados de execução.'}/>
          {i?.financeiro.atual.avisos.map(a=><Typography.Paragraph key={a}>{a}</Typography.Paragraph>)}
        </Flex>},
        {key:'escolas',label:'Escolas',children:<><Typography.Paragraph>{i?.criteriosEscolas}</Typography.Paragraph><Table rowKey="codigo" size="small" dataSource={i?.escolas} pagination={{pageSize:8}} columns={[{title:'Código',dataIndex:'codigo'},{title:'Escola',dataIndex:'nome'},{title:'Sinais',render:(_,s)=>s.sinais.map(x=>`${x.indicador}: ${x.valor} (${x.ano})`).join('; ')||'Sem sinal pelas regras aplicadas'},{title:'Conciliação',render:(_,s)=>s.verificacaoCadastro?'Conferir recortes':'Presença coincidente'}]}/></>},
        {key:'monitoramento',label:'Fontes e mudanças',children:<><Typography.Paragraph>{i?.monitoramento.nota}</Typography.Paragraph><Typography.Paragraph>{i?.monitoramento.anteriorEm?`Comparação com ${i.monitoramento.anteriorEm}`:'Primeira coleta; linha de base registrada.'}</Typography.Paragraph><Table size="small" rowKey={(_,index)=>String(index)} dataSource={i?.monitoramento.mudancas} pagination={{pageSize:8}} columns={[{title:'Dado',dataIndex:'id'},{title:'Período',dataIndex:'periodo'},{title:'Antes',render:(_,r)=>String(r.antes??'N/D')},{title:'Depois',render:(_,r)=>String(r.depois??'N/D')}]}/></>},
        {key:'simulacao',label:'Simulador separado',children:<Simulador exercicio={exercicio}/>},
      ]}/>}
    </Flex>
    <Modal title={acao?.titulo} open={Boolean(acao)} onCancel={()=>setAcao(null)} onOk={()=>form.submit()} confirmLoading={salvar.isPending} width={760} forceRender>
      <Alert type="info" title="Entrega concluída e resultado financeiro são verificações distintas." description={`Linha de base: ${registros.data?.find(r=>r.acaoId===acao?.id)?.linhaBase??acao?.evidencia.descricao??''}`}/>
      <Form form={form} layout="vertical" onFinish={v=>salvar.mutate(v)} preserve={false} initialValues={acompanhamentoVazio}>
        <Form.Item name="status" label="Situação"><Select options={ESTADOS_ACAO.map(value=>({value,label:labels[value]}))}/></Form.Item>
        <Flex gap={12}><Form.Item name="responsavel" label="Responsável"><Input maxLength={150}/></Form.Item><Form.Item name="prazo" label="Prazo pactuado"><Input type="date"/></Form.Item></Flex>
        {([['entrega','Entrega realizada'],['evidencia','Documento, protocolo ou referência da evidência'],['resultadoObservado','Resultado observado ou motivo do descarte']] as const).map(([name,label])=><Form.Item name={name} label={label} key={name}><Input.TextArea rows={2} maxLength={4000}/></Form.Item>)}
        <Typography.Paragraph>Valores opcionais, informados pela equipe e sujeitos à revisão. Não somar receita preservada a dinheiro novo.</Typography.Paragraph>
        <Flex gap={12} wrap>{([['receitaAdicional','Receita adicional'],['receitaPreservada','Receita preservada'],['economia','Economia'],['custoIntervencao','Custo da intervenção'],['honorarios','Honorários']] as const).map(([name,label])=><Form.Item name={name} label={`${label} (R$)`} key={name}><InputNumber min={0} precision={2}/></Form.Item>)}</Flex>
        <Form.Item name="memoriaFinanceira" label="Memória de cálculo e vínculo com a intervenção"><Input.TextArea rows={2} maxLength={4000}/></Form.Item><Form.Item name="revisadoPor" label="Revisão técnica registrada por"><Input maxLength={150}/></Form.Item>
      </Form>
    </Modal>
  </Card>;
}

function Simulador({exercicio}:{exercicio:number}) {
  const {message}=App.useApp();
  const [resultado,setResultado]=useState<ReturnType<typeof simularMudancaJornada>|null>(null);
  return <><Alert type="warning" title="Simulação hipotética, separada do diagnóstico" description="Informe premissas verificadas e suas fontes. O cálculo mantém o valor por equivalente constante; não estima o rateio futuro nem garante repasse."/>
    <Form layout="vertical" initialValues={{exercicioReferencia:exercicio}} onFinish={(v:PremissasSimulacao&{fonte:string})=>{try{const r=simularMudancaJornada(v);setResultado(r);}catch(e){message.error(e instanceof Error?e.message:'Premissas inválidas');}}}>
      <Flex gap={12} wrap>{([['quantidade','Matrículas existentes a mudar'],['limiteElegivel','Matrículas elegíveis validadas'],['fatorAtual','Fator atual'],['fatorNovo','Fator da hipótese'],['valorEquivalente','Valor por equivalente (R$)'],['custoAdicionalAnual','Custo anual adicional (R$)'],['exercicioReferencia','Ano de referência']] as const).map(([name,label])=><Form.Item name={name} label={label} key={name} rules={name==='custoAdicionalAnual'?[]:[{required:true,message:'Informe a premissa.'}]}><InputNumber min={0}/></Form.Item>)}</Flex>
      <Form.Item name="fonte" label="Fontes e validação das premissas" rules={[{required:true,message:'Registre a origem das premissas.'}]}><Input.TextArea maxLength={4000}/></Form.Item><Button htmlType="submit">Calcular hipótese</Button>
    </Form>
    {resultado&&<Alert type="info" title={`Referência bruta: ${resultado.receitaBrutaReferencial.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`} description={`${resultado.formula}. Saldo referencial após custo: ${resultado.saldoReferencial===null?'não calculado':resultado.saldoReferencial.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}. ${resultado.ressalva}`}/>}</>;
}
