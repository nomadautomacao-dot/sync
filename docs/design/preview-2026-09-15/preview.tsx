import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App, Alert, Avatar, Button, Card, ConfigProvider, Drawer, Empty, Flex, Grid, Input, Result, Segmented, Select, Space, Statistic, Tabs, Tag, Typography, theme } from 'antd';
import ptBR from 'antd/locale/pt_BR';
import { ProLayout, ProTable, ProDescriptions } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { ArrowLeftOutlined, ArrowRightOutlined, EnvironmentOutlined, FileTextOutlined, FolderOpenOutlined, SearchOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { identidade, tema } from './tema';

// Exceção de montagem: este documento tem raiz própria, fora do Next e do
// AuthProvider. Seu ConfigProvider não duplica o provider do produto.
// Nenhuma chamada de rede ou mutação do sistema ocorre nesta prévia.
const { Title, Text, Paragraph } = Typography;
type Tela = 'cidades' | 'ficha' | 'emissao';
type Estado = 'normal' | 'carregando' | 'vazio' | 'erro' | 'parcial';
type Cidade = { id: number; nome: string; documentos: number; atividade: string; situacao: string };
const nomes = ['Serra do Ramalho', 'Bom Jesus da Lapa', 'Carinhanha', 'Riacho de Santana', 'Santa Maria da Vitória', 'Santana', 'São Félix do Coribe', 'Coribe', 'Cocos', 'Feira da Mata', 'Malhada', 'Ibotirama', 'Paratinga', 'Sítio do Mato', 'Muquém do São Francisco', 'Morpará', 'Buritirama'];
const cidades: Cidade[] = nomes.map((nome, id) => ({ id, nome, documentos: id === 0 ? 30 : (id * 7) % 14, atividade: ['Hoje', 'Ontem', 'Há 3 dias'][id % 3], situacao: ['Em acompanhamento', 'Revisar documentos', 'Aguardando dados'][id % 3] }));
const tipos = ['Raio-X Municipal', 'Diagnóstico FUNDEB', 'Dever de Casa', 'Histórico do Censo Escolar', 'Ofício de solicitação de documentos', 'Dossiê das Escolas', 'Dossiê da Conformidade', 'Dossiê da Matrícula Ponderada', 'Dossiê do Dinheiro Federal', 'Dossiê da Aprendizagem', 'Dossiê da Demanda', 'Dossiê da Equidade e dos Territórios', 'Dossiê Comparativo'];
type Documento = { id: number; nome: string; versao: number; tipo: string; status: string };
const arquivos: Documento[] = Array.from({ length: 30 }, (_, id) => ({ id, nome: tipos[id % tipos.length], versao: Math.floor(id / tipos.length) + 1, tipo: 'PDF', status: 'Disponível' }));

function Preview() {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const [tela, setTela] = useState<Tela>('cidades');
  const [cidade, setCidade] = useState(cidades[0]);
  const [perfil, setPerfil] = useState('Consultora');
  const [estado, setEstado] = useState<Estado>('normal');
  const [busca, setBusca] = useState('');
  const [aba, setAba] = useState('documentos');
  const [aberto, setAberto] = useState<string | null>(null);
  const [filaAberta, setFilaAberta] = useState(false);
  const [falha, setFalha] = useState(true);
  const [adicionados, setAdicionados] = useState<string[]>([]);
  const gestor = perfil === 'Gestão';
  const mono = { fontFamily: token.fontFamilyCode };
  const espaco = { padding: screens.md ? 24 : 12 };
  const navegar = (nova: Tela) => { setTela(nova); setEstado('normal'); setBusca(''); };
  const abrirCidade = (item: Cidade) => { setCidade(item); setAba('documentos'); navegar('ficha'); };
  const abrirArquivo = (nome: string) => setAberto(nome);
  const semDados = estado === 'vazio';
  const linhas = semDados ? [] : cidades.filter(c => c.nome.toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR')));
  const enfileirar = (nome: string) => { setAdicionados(itens => itens.includes(nome) ? itens : [...itens, nome]); setFilaAberta(true); };
  const tabelaBase = { search: false as const, options: false as const, pagination: false as const, size: 'small' as const, cardProps: { styles: { body: { padding: 0 } } } };
  const colunas: ProColumns<Cidade>[] = [
    { title: 'Município', dataIndex: 'nome', sorter: (a,b) => a.nome.localeCompare(b.nome, 'pt-BR'), render: (_, r) => <Button size="small" type="link" style={{ padding: 0, fontWeight: 600 }} onClick={() => abrirCidade(r)}>{r.nome}</Button> },
    { title: 'UF', width: 56, render: () => <Text style={mono}>BA</Text> },
    { title: 'Documentos', dataIndex: 'documentos', width: 112, align: 'right', sorter: (a,b) => a.documentos-b.documentos, render: (_,r) => <Text style={mono}>{r.documentos}</Text> },
    { title: 'Atividade', dataIndex: 'atividade', width: 100 },
    { title: 'Situação operacional', dataIndex: 'situacao', width: 210, render: (_,r) => <Space><span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: r.id%3 === 0 ? token.colorSuccess : token.colorWarning }} /><Text>{r.situacao}</Text></Space> },
    ...(gestor ? [{ title: 'Estágio comercial', width: 150, render: () => <Tag>Diagnóstico</Tag> }] : []),
    { title: 'Ação', width: 80, render: (_,r) => <Button size="small" type="text" onClick={() => abrirCidade(r)} aria-label={`Abrir ${r.nome}`} icon={<ArrowRightOutlined />} /> },
  ];
  const colunasArquivos: ProColumns<Documento>[] = [
    { title: 'Documento', dataIndex: 'nome', render: (_,r) => <Space><FileTextOutlined /><Text strong>{r.nome}</Text>{r.nome === 'Dever de Casa' && <Tag>Uso interno</Tag>}</Space> },
    { title: 'Versão', dataIndex: 'versao', width: 84, align: 'right', render: (_,r) => <Text style={mono}>v{r.versao}</Text> },
    { title: 'Formato', dataIndex: 'tipo', width: 85 },
    { title: 'Situação', dataIndex: 'status', width: 116 },
    { title: 'Ação', width: 80, render: (_,r) => <Button size="small" onClick={() => abrirArquivo(r.nome)}>Abrir</Button> },
  ];
  const documentos = arquivos.slice(0, cidade.documentos).filter(d => d.nome.toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR')));
  const cabecalho = (titulo: string, descricao: string, acao?: React.ReactNode) => <Flex align="end" justify="space-between" gap={16} wrap style={{ marginBottom: 24 }}><div><Text type="secondary">GLOBAL COMPANY / CONSULTORIA EDUCACIONAL</Text><Title level={1} style={{ margin: '6px 0', fontSize: 32, letterSpacing: -1.3 }}>{titulo}</Title><Text type="secondary">{descricao}</Text></div>{acao}</Flex>;
  const contexto = <Space wrap><Tag>Bahia</Tag><Text type="secondary">Carteira demonstrativa</Text><Button type="link" onClick={() => navegar('cidades')}>Trocar município</Button></Space>;

  return <ProLayout
    title="Global Sync" logo={<span style={{ background: identidade.lima, color: identidade.tinta, padding: '4px 8px', borderRadius: token.borderRadius, fontWeight: 800 }}>S↗</span>}
    layout="side" navTheme="light" headerRender={false} siderWidth={208} fixSiderbar
    location={{ pathname: '/' + tela }}
    token={{ pageContainer: { paddingInlinePageContainerContent: 0, paddingBlockPageContainerContent: 0 }, sider: { colorMenuBackground: token.colorBgContainer, colorBgMenuItemSelected: identidade.lima, colorTextMenuSelected: identidade.tinta } }}
    route={{ routes: [
      { path: '/cidades', name: 'Cidades', icon: <EnvironmentOutlined /> },
      { path: '/ficha', name: 'Ficha municipal', icon: <FolderOpenOutlined /> },
      { path: '/emissao', name: 'Emitir relatórios', icon: <ThunderboltOutlined /> },
    ] }}
    menuItemRender={(item, dom) => <a href={'#' + item.path?.slice(1)} onClick={e => { e.preventDefault(); navegar(item.path?.slice(1) as Tela); }}>{dom}</a>}
    menuFooterRender={() => <Flex vertical gap={12} style={{ padding: 16 }}><Button icon={<ThunderboltOutlined />} onClick={()=>setFilaAberta(true)}>Fila · {falha ? "1 falha" : "em andamento"}</Button><Text type="secondary">Proposta de interface<br />15 setembro 2026</Text><Space><Avatar style={{ background: identidade.tinta }}>GS</Avatar><div><Text strong>{perfil}</Text><br /><Text type="secondary">Perfil demonstrativo</Text></div></Space></Flex>}
    contentStyle={{ padding: 0, background: token.colorBgLayout, minHeight: '100vh' }}
  >
    <Flex align="center" justify="space-between" gap={12} wrap style={{ padding: '12px 24px', borderBottom: `1px solid ${token.colorBorder}`, background: token.colorBgContainer }}>
      <Space wrap><Tag bordered={false}>PRÉVIA · DADOS DEMONSTRATIVOS</Tag><Text type="secondary">CRM × Mission</Text></Space>
      <Space wrap><Select aria-label="Simular estado" value={estado} onChange={setEstado} options={[{value:'normal',label:'Estado: normal'},{value:'carregando',label:'Carregando'},{value:'vazio',label:'Vazio'},{value:'erro',label:'Erro'},{value:'parcial',label:'Dado parcial'}]} /><Segmented aria-label="Perfil da prévia" value={perfil} options={['Consultora','Gestão']} onChange={value => { setPerfil(value); if(value === 'Consultora' && aba === 'contrato') setAba('documentos'); }} /></Space>
    </Flex>
    <main style={espaco}>
      {tela === 'cidades' && cabecalho('Cada cidade, um próximo passo.', 'Sua carteira e o material necessário para a próxima conversa.', <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => navegar('emissao')}>Emitir relatório</Button>)}
      {tela === 'ficha' && <><Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navegar('cidades')} style={{ marginBottom: 12 }}>Cidades</Button>{cabecalho(cidade.nome, 'Documentos, dados e acompanhamento no mesmo lugar.', <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => navegar('emissao')}>Emitir relatório</Button>)}{contexto}</>}
      {tela === 'emissao' && <>{cabecalho('Da informação à decisão.', 'Escolha o documento. Acompanhe a emissão. Abra o material.', <Button icon={<FolderOpenOutlined />} onClick={() => navegar('ficha')}>Documentos da cidade</Button>)}<Card size="small" style={{ marginBottom: 20 }}><Flex justify="space-between" align="center" wrap gap={8}><Text strong>{cidade.nome}</Text>{contexto}</Flex></Card></>}
      {estado === 'parcial' && <Alert style={{ marginBottom: 16 }} type="warning" showIcon title="Dados parciais — uma fonte está indisponível" description="Censo Escolar: não disponível nesta simulação. Os arquivos já emitidos continuam acessíveis. Valores ausentes aparecem como —." />}
      {estado === 'erro' ? <Result status="warning" title="Não foi possível carregar este conteúdo" subTitle="O contexto da cidade foi preservado. Tente consultar novamente." extra={<Button type="primary" onClick={() => setEstado('normal')}>Tentar novamente</Button>} /> : <>
        {tela === 'cidades' && <>
          <Flex gap={40} wrap style={{ paddingBottom: 24 }}><Statistic title="Municípios na carteira" value={17} styles={{ content: { ...mono, fontSize: 26 } }} /><Statistic title="Com documento" value={cidades.filter(c=>c.documentos>0).length} styles={{ content: { ...mono, fontSize: 26 } }} /><Statistic title="Precisam de revisão" value={cidades.filter(c=>c.id%3===1).length} styles={{ content: { ...mono, fontSize: 26 } }} /></Flex>
          <Card styles={{ body: { padding: 16 } }}>
            <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 16 }}><Space><Text strong>Carteira municipal</Text><Tag>{linhas.length}</Tag></Space><Input aria-label="Buscar município" placeholder="Buscar município" prefix={<SearchOutlined />} allowClear value={busca} onChange={e => setBusca(e.target.value)} style={{ width: screens.md ? 290 : '100%' }} /></Flex>
            <ProTable<Cidade> {...tabelaBase} rowKey="id" dataSource={linhas} columns={colunas} loading={estado === 'carregando'} scroll={{ x: gestor ? 1050 : 850 }} locale={{ emptyText: <Empty description={semDados ? 'Sua carteira ainda está vazia' : 'Nenhuma cidade corresponde à busca'} image={Empty.PRESENTED_IMAGE_SIMPLE}><Button onClick={() => {setEstado('normal');setBusca('');}}>Restaurar exemplo</Button></Empty> }} />
          </Card>
        </>}
        {tela === 'ficha' && <Tabs activeKey={aba} onChange={setAba} items={[
          { key:'visao', label:'Visão geral', children:<Card><ProDescriptions title="Contexto municipal" column={screens.md ? 2 : 1} dataSource={{cidade:cidade.nome,uf:'Bahia',situacao:'Em acompanhamento',fontes:estado==='parcial'?'Dados parciais':'Consultar no documento emitido'}} columns={[{title:'Município',dataIndex:'cidade'},{title:'Estado',dataIndex:'uf'},{title:'Situação',dataIndex:'situacao'},{title:'Fontes e ano',dataIndex:'fontes'}]} /></Card> },
          { key:'atendimento',label:'Atendimento',children:<Card><Tabs items={['Linha do tempo','Contatos','Cronograma','Projetos'].map(label=>({key:label,label,children:<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`${label}: área reservada nesta proposta`} />}))} /></Card> },
          { key:'documentos',label:'Documentos',children:<Card styles={{body:{padding:16}}}><Flex justify="space-between" align="center" wrap gap={12} style={{marginBottom:16}}><Text strong>Arquivos do município · {cidade.documentos} no exemplo</Text><Input aria-label="Buscar documento" placeholder="Buscar documento" prefix={<SearchOutlined />} value={busca} onChange={e=>setBusca(e.target.value)} allowClear style={{width:screens.md?290:'100%'}} /></Flex><ProTable<Documento> {...tabelaBase} rowKey="id" loading={estado==='carregando'} scroll={{x:750}} dataSource={semDados?[]:documentos} columns={colunasArquivos} locale={{emptyText:<Empty description="Nenhum documento nesta visualização"><Button onClick={()=>navegar('emissao')}>Escolher relatório</Button></Empty>}} /></Card> },
          { key:'fundeb',label:'Dados FUNDEB',children:<Card><ProDescriptions title="Número com procedência" column={1} columns={[{title:'Repasse VAAR',render:()=> <Text style={mono}>—</Text>},{title:'Fonte',render:()=> 'FNDE'},{title:'Exercício',render:()=> 'Selecionado na consulta real'},{title:'Situação',render:()=> 'Valor não carregado nesta prévia'}]} /><Alert type="info" showIcon title="Ausência de dado não significa zero" /></Card> },
          ...(gestor?[{key:'contrato',label:'Contrato',children:<Card><Empty description="Área administrativa demonstrativa. Contratos e valores dependem da sessão real." /></Card>}]:[]),
        ]} />}
        {tela === 'emissao' && <Card styles={{body:{padding:16}}}><ProTable<{id:number;nome:string}> {...tabelaBase} rowKey="id" loading={estado==='carregando'} scroll={{x:800}} dataSource={semDados?[]:tipos.map((nome,id)=>({nome,id}))} columns={[
          {title:'Documento',dataIndex:'nome',render:(_,r)=><Space><FileTextOutlined /><Text strong>{r.nome}</Text>{r.id===2&&<Tag>Uso interno</Tag>}</Space>},
          {title:'Disponibilidade',width:210,render:(_,r)=>r.id===0?<Tag icon={<ThunderboltOutlined />}>Gerando · consultando fontes</Tag>:r.id===1&&falha?<Tag color="error">Falhou · fonte indisponível</Tag>:r.id===1||[3,4,5].includes(r.id)||adicionados.includes(r.nome)?<Tag>Na fila</Tag>:<Text type="secondary">Pronto para solicitar</Text>},
          {title:'Ação',width:140,render:(_,r)=>r.id===0?<Button size="small" onClick={()=>setFilaAberta(true)}>Acompanhar</Button>:r.id===1&&falha?<Button size="small" onClick={()=>{setFalha(false);setFilaAberta(true);}}>Tentar novamente</Button>:r.id===1||[3,4,5].includes(r.id)||adicionados.includes(r.nome)?<Button size="small" onClick={()=>setFilaAberta(true)}>Ver fila</Button>:<Button size="small" onClick={()=>enfileirar(r.nome)}>Solicitar</Button>},
        ]} locale={{emptyText:<Empty description="Nenhum tipo disponível nesta simulação"><Button onClick={()=>setEstado('normal')}>Restaurar catálogo</Button></Empty>}} /></Card>}
      </>}
      <Flex align="center" justify="space-between" wrap gap={12} style={{marginTop:20,padding:'14px 16px',background:token.colorBgContainer,borderTop:`2px solid ${identidade.tinta}`}}><Space wrap><ThunderboltOutlined /><Text strong>Central de emissão</Text><Text type="secondary">1 gerando · {3+adicionados.length+(falha?0:1)} na fila</Text>{falha&&<Tag color="error">1 falha</Tag>}</Space><Button onClick={()=>setFilaAberta(true)}>Acompanhar fila</Button></Flex>
      <Paragraph type="secondary" style={{marginTop:12,fontSize:12}}>Proposta visual com dados demonstrativos. Navegação, busca, estados e fila são simulados; nenhuma consulta ou emissão real é executada.</Paragraph>
    </main>
    <Drawer title="Central de emissão · simulação" open={filaAberta} onClose={()=>setFilaAberta(false)} size={screens.md?480:'100%'}>
      <Flex vertical gap={16}><Alert type="info" showIcon title="Raio-X Municipal — consultando fontes" description={`${cidade.nome}. Uma emissão por vez; você pode navegar entre as telas.`} /><Text strong>Próximos documentos</Text>{['Histórico do Censo Escolar','Ofício de solicitação de documentos','Dossiê das Escolas',...(!falha?['Diagnóstico FUNDEB']:[]),...adicionados].map((nome,i)=><Text key={nome}><Text style={mono}>{i+1}.</Text> {nome}</Text>)}{falha&&<Alert type="error" showIcon title="Diagnóstico FUNDEB não foi concluído" description="A fonte não respondeu. A falha permanece aqui até uma nova tentativa." action={<Button size="small" onClick={()=>setFalha(false)}>Tentar novamente</Button>} />}<Text type="secondary">Na aplicação atual, fechar a janela interrompe o processamento; a fila é retomada ao reabrir.</Text></Flex>
    </Drawer>
    <Drawer title="Visualizador de documento" open={Boolean(aberto)} onClose={()=>setAberto(null)} size={screens.md?640:'100%'}><Tag>PRÉVIA DEMONSTRATIVA</Tag><Title level={2}>{aberto}</Title><Paragraph>{cidade.nome} · Bahia</Paragraph><Alert type="info" showIcon title="Área de leitura do arquivo" description="O documento real será aberto pelo visualizador já existente no Sync. Esta proposta mostra o acesso e a hierarquia; nenhum PDF foi gerado." />{aberto==='Dever de Casa'&&<Alert style={{marginTop:16}} type="warning" showIcon title="Material de uso interno — não apresentar automaticamente ao gestor municipal" />}</Drawer>
  </ProLayout>;
}

createRoot(document.getElementById('root')!).render(<ConfigProvider theme={tema} locale={ptBR}><App><Preview /></App></ConfigProvider>);
