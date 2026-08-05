# Console de sistemas — `/sistemas`

> A aba do Sync que administra os outros produtos Global: cadastrar prefeitura,
> criar acesso, conceder papel, ver o que foi feito.
>
> Criado em 2026-08-02.

---

## 1. Por que dentro do Sync

A alternativa considerada era um app separado, "modo dev", em Vite. Ela morre
num detalhe técnico que não tem contorno barato:

**Provisionar usuário exige o Admin SDK, e o Admin SDK exige servidor.** As
security rules do GlobalEdu não deixam ninguém escrever em `users/{uid}` sem já
ter perfil lá dentro — e a **primeira** conta de um município é justamente a que
não tem ninguém para criá-la. Esse ovo-e-galinha só se quebra por fora, com uma
credencial que ignora as rules. Uma SPA em Vite precisaria de um backend só para
essa parte; seriam duas coisas onde já existe uma.

> **Correção de 2026-08-05.** Este parágrafo afirmava que só `global_admin`
> escreve em `users`. As rules publicadas no banco `globaledu` (atualizadas em
> 2026-08-02) dizem outra coisa:
>
> ```
> function administraUsuarios() {
>   return ativo() && papel() in ['global_admin', 'consultor', 'sec_educacao'];
> }
> ```
>
> Ou seja: **a Secretaria de Educação do município administra os próprios
> usuários de dentro do GlobalEdu.** Ela não pode apenas criar `global_admin` —
> esse continua exclusivo de quem já é. Isso muda o papel deste console: ele
> provisiona a **primeira** conta de cada prefeitura, e a partir dela o cliente
> se vira sozinho.
>
> **Dívida conhecida, no repositório do GlobalEdu:** o `match /users/` é o único
> bloco das rules que **não** passa por `noTenant(data)`. Uma `sec_educacao`
> pode listar e criar usuários de **qualquer** prefeitura, não só da sua. Com um
> município só isso não tem efeito; com dois, tem. Corrigir antes da segunda.

E o Sync já é o control plane, quase por acidente:

- `core/lib/firebase-admin.ts` mantém um Admin SDK autenticado no projeto
  `globalconsultorias` — o mesmo projeto onde vive o banco `globaledu`.
- `firebase-admin@14` endereça banco nomeado direto: `getFirestore(app, "globaledu")`.
- Sessão, RBAC, shell do Ant, pipeline de deploy, suíte de testes e cofre da
  service account: tudo já existe e não precisa ser reescrito.

Some-se que o Sync é **interno**. Ninguém de fora da Global Company entra aqui
(`PRODUCT.md`: o gestor municipal *recebe* relatório, não loga). O motivo
clássico para separar um console — não embarcar o painel de administração no
produto que o cliente usa — não se aplica.

**Quando reconsiderar:** se um dia entrar cliente ou parceiro no Sync, ou gente
cuja conta não pode ficar a um bug de distância do console. Aí separa-se — e
mesmo assim em Next, não em Vite, pelo mesmo motivo do servidor. Por isso todo o
console vive em três pastas próprias (`app/(sync)/sistemas/`,
`app/api/sistemas/`, `core/lib/sistemas-*.ts`), sem nada compartilhado com o
resto: separar depois é mover pastas, não reescrever.

---

## 2. O catálogo

`core/domain/sistemas.ts` é o registro dos produtos. Cada entrada declara o
*dialeto* do produto — como ele chama a coleção de clientes, os campos do
documento e as custom claims que espera:

```ts
{
  id: "globaledu",
  databaseId: "globaledu",             // banco nomeado no projeto
  colecaoPrefeituras: "tenants",
  colecaoUsuarios: "users",
  camposPrefeitura: { nome: "name", slug: "slug", uf: "uf", ... },
  camposUsuario:    { papel: "role", prefeitura: "tenantId", ... },
  claims:           { papel: "role", prefeitura: "tenantId", prefeituras: "tenantIds" },
  papeis: [...],
  statusPrefeitura: [...],
}
```

O console fala o dialeto do produto ao escrever, em vez de impor o dele. **Somar
um produto ao console é somar uma entrada aqui** — telas e rotas passam a
atendê-lo sem mais nenhuma alteração.

O arquivo é puro: sem I/O, sem `firebase-admin`. É importado pelo servidor e
pelas telas, então não pode arrastar SDK de servidor para o bundle. O que vai
para o navegador é a projeção `paraTela()`, que deixa de fora os mapas de campo
e de claim.

Contrato completo do lado do GlobalEdu: `docs/PROVISIONAMENTO.md` **naquele**
repositório.

---

## 3. Arquivos

| Arquivo | Papel |
|---|---|
| `core/domain/sistemas.ts` | Catálogo, tradução de campos, claims, schemas Zod. Puro |
| `core/domain/sistemas.test.ts` | 21 testes do núcleo puro |
| `core/domain/rbac.ts` | `podeAdministrarSistemas()` — régua em `admin` |
| `core/lib/sistemas-admin.ts` | Admin SDK: bancos nomeados, Auth, provisionamento |
| `core/lib/sistemas-registro.ts` | Trilha do console na coleção `audit` |
| `core/lib/sistemas-http.ts` | Guarda, parse Zod e tradução de erro das rotas |
| `app/api/sistemas/**` | As rotas (seção 4) |
| `app/(sync)/sistemas/page.tsx` | Lista de produtos |
| `app/(sync)/sistemas/[sistema]/page.tsx` | Prefeituras, Usuários, Registro |
| `app/(sync)/sistemas/_components/` | Diálogos de prefeitura e usuário |
| `app/(sync)/sistemas/_lib/api.ts` | Cliente das rotas, sobre `apiFetch` |

---

## 4. Rotas

Todas exigem `getSessionUser()` **e** `podeAdministrarSistemas(groupRole)`.

| Rota | Método | O quê |
|---|---|---|
| `/api/sistemas` | GET | Catálogo + contagem e saúde de cada produto |
| `/api/sistemas/[sistema]` | GET | Um produto + contagem |
| `/api/sistemas/[sistema]/prefeituras` | GET, POST | Listar, cadastrar |
| `/api/sistemas/[sistema]/prefeituras/[prefeitura]` | PATCH | Nome, UF, situação, IBGE |
| `/api/sistemas/[sistema]/usuarios` | GET, POST | Listar (`?prefeitura=`), provisionar |
| `/api/sistemas/[sistema]/usuarios/[uid]` | PATCH, DELETE | Editar; revogar acesso ao produto |
| `/api/sistemas/[sistema]/usuarios/[uid]/acoes` | POST | `ressincronizar_claims`, `link_de_senha` |
| `/api/sistemas/municipios` | GET | Busca por nome (`?q=`, `?uf=`) — alimenta o autocomplete |
| `/api/sistemas/municipios/[codigoIbge]` | GET | Dossiê do município (seção 4.1) |
| `/api/sistemas/registro` | GET | Trilha do console (`?sistema=`) |

### 4.1 Cadastro por nome — o dossiê do município

Cadastrar prefeitura é digitar o nome e escolher na lista. A partir daí o
console preenche sozinho: UF, código IBGE, região, identificador, e o perfil do
município que a Global já tem — população (IBGE), prefeito eleito e partido
(TSE), Censo Escolar da rede municipal e IDEB (INEP).

**Tudo sai de dataset local** (`data/*.json`, bundlado no build). Nenhuma
chamada de rede, exceto a busca por nome, que consulta o IBGE e fica 12 h em
cache de processo. A regra em `core/lib/municipios-dossie.ts` é explícita:
indicador que exija rede (SICONFI, QEdu, FNDE, Portal da Transparência) **não
entra no cadastro** — diálogo que espera API de governo é diálogo que trava.
Para o caminho lento existem os relatórios do FUNDEB.

A identidade do município (nome, UF, região) vai do cliente para o dossiê por
query string, em vez de o servidor reconsultar o IBGE: a busca já a devolveu, e
é uma fonte a menos para cair no meio de um cadastro. Se o IBGE não responder, a
tela avisa e o cadastro segue à mão.

O que é gravado no documento da prefeitura está em `docs/PROVISIONAMENTO.md` do
produto. O campo que justifica o resto é `referenciaCenso`: a linha de base
contra a qual se mede a implantação ("12 das 41 escolas cadastradas"). É uma
fotografia com o ano junto, não um valor vivo.

`DELETE` **não apaga conta**: remove as claims daquele produto e marca
`ativo: false`. A conta pode ser a mesma que a pessoa usa no Sync.

---

## 5. Permissão

`podeAdministrarSistemas` fica em `core/domain/rbac.ts` e exige `admin` ou
`owner`. A régua é alta porque o console cria conta, concede papel e escreve no
banco de outro produto **pelo Admin SDK, que ignora as rules dele** — é o poder
mais alto que existe neste projeto.

A guarda está na rota. O item escondido na barra lateral é conveniência: quem
tem sessão pode chamar a rota na mão.

---

## 6. As três armadilhas do Firebase compartilhado

Estão comentadas no código, e são a razão de o console existir em vez de um
punhado de scripts.

**1. O Auth é um só para o projeto.** A mesma conta pode ser consultor no Sync e
diretor no GlobalEdu. E `setCustomUserClaims` **substitui** o objeto inteiro em
vez de mesclar — gravar as claims de um produto por cima apagaria as do outro.
Daí `mesclarClaims()`, com teste dedicado. Corolário: as chaves de claim não
podem colidir entre produtos do catálogo.

**2. Conta preexistente não tem a senha tocada.** `provisionarUsuario` procura
por e-mail antes de criar. Se acha, vincula. Trocar a senha por causa de um
cadastro novo derrubaria o acesso que a pessoa já tinha em outro produto.

**3. Documento e claim divergem em silêncio.** As rules leem o token, não o
Firestore. Documento editado sem regravar a claim produz "entrei e não vejo
nada". A listagem cruza os dois (`divergenciaDeClaims`) e mostra *Token
desatualizado*, com a ressincronização num clique.

Há ainda um quarto detalhe: `databaseId` errado não dá erro de permissão, dá
`NOT_FOUND`. `resumoDoSistema` traduz isso para "o banco X não existe no
projeto" em vez de repassar o texto do gRPC.

---

## 7. Senha

O caminho recomendado é **não definir senha**: a conta nasce sem credencial e o
console gera um link de definição, válido por uma hora e de uso único. A senha
nunca passa pelo operador.

O Admin SDK gera o link mas **não envia e-mail** — o Sync não tem serviço de
e-mail. A entrega é manual, e com prefeitura isso costuma funcionar melhor.

O link **não** entra na trilha de auditoria: quem lesse o log assumiria a conta.

---

## 8. Trilha

Toda escrita registra em `audit`, no banco `(default)` — o do próprio Sync, não
o do produto administrado: a trilha precisa sobreviver mesmo que o banco do
produto seja apagado. As rules já barram escrita pelo cliente (`allow write: if
false`), então só chega ali pelo Admin SDK.

`registrarNoConsole` **nunca lança**: auditoria que derruba a operação auditada
transforma log indisponível em recurso indisponível. Falha vai para o Error
Reporting.

A consulta usa só `where("groupId", "==", ...)` e ordena em memória — evita um
índice composto por combinação de filtro, e o volume é de dezenas de eventos.

---

## 9. O que não existe

- **Apagar prefeitura.** Deixaria matrículas e arquivos sem dono. Desativar é
  `status: "suspenso"`
- **Renomear o slug.** É a chave nas claims de todo mundo e nos caminhos do
  Storage
- **Apagar conta.** É operação do console do Firebase, com intenção explícita
- **Provisionar em lote** (planilha de escolas, importação de servidores)
- **O Sync administrando a si mesmo.** Os usuários do Sync vivem só no Auth,
  com `groupId`/`groupRole`; não há coleção `users` para listar. Entraria no
  catálogo com uma forma diferente da dos demais
- **Verificação em navegador.** As telas foram checadas por tipo, lint e build;
  o passeio pela interface ainda não foi feito
