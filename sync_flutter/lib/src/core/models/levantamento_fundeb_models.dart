class MunicipioLookupRequest {
  const MunicipioLookupRequest({
    this.codigoIbge,
    this.nome,
    this.uf,
    required this.exercicio,
  });

  final String? codigoIbge;
  final String? nome;
  final String? uf;
  final int exercicio;

  bool get hasCodigoIbge => _normalizeCode(codigoIbge).length == 7;
  bool get hasNameLookup =>
      _normalizeText(nome).length >= 2 && _normalizeUf(uf).length == 2;

  Map<String, dynamic> toJson() {
    if (hasCodigoIbge) {
      return {
        'codigo_ibge': _normalizeCode(codigoIbge),
        'exercicio': exercicio,
      };
    }

    return {
      'nome': _normalizeText(nome),
      'uf': _normalizeUf(uf),
      'exercicio': exercicio,
    };
  }

  static String _normalizeCode(String? value) {
    return (value ?? '').replaceAll(RegExp(r'[^0-9]'), '');
  }

  static String _normalizeText(String? value) {
    return (value ?? '').trim();
  }

  static String _normalizeUf(String? value) {
    return (value ?? '').trim().toUpperCase();
  }
}

class MunicipioSearchItem {
  const MunicipioSearchItem({
    required this.codigoIbge,
    required this.nome,
    required this.uf,
    required this.regiao,
  });

  final String codigoIbge;
  final String nome;
  final String uf;
  final String regiao;

  factory MunicipioSearchItem.fromJson(Map<String, dynamic> json) {
    return MunicipioSearchItem(
      codigoIbge: _readString(json, 'codigo_ibge'),
      nome: _readString(json, 'nome'),
      uf: _readString(json, 'uf'),
      regiao: _readString(json, 'regiao'),
    );
  }
}

class LevantamentoFundebBundle {
  const LevantamentoFundebBundle({
    required this.relatorio,
    required this.fontes,
    this.relatorioDirigidoBase,
    this.ibgePerfil,
  });

  final RelatorioFundeb relatorio;
  final List<FonteColetaStatus> fontes;
  final RelatorioDirigidoMunicipio? relatorioDirigidoBase;
  final IbgeMunicipioPerfil? ibgePerfil;
}

class IbgeMunicipioPerfil {
  const IbgeMunicipioPerfil({
    this.areaTerritorial,
    this.areaAnoReferencia,
    this.populacaoUltimoCenso,
    this.populacaoUltimoCensoAnoReferencia,
    this.densidadeDemografica,
    this.densidadeAnoReferencia,
    this.populacaoEstimada,
    this.populacaoEstimadaAnoReferencia,
    this.escolarizacao614,
    this.escolarizacaoAnoReferencia,
    this.idhm,
    this.idhmAnoReferencia,
    this.mortalidadeInfantil,
    this.mortalidadeAnoReferencia,
    this.receitasBrutasRealizadas,
    this.receitasAnoReferencia,
    this.despesasBrutasEmpenhadas,
    this.despesasAnoReferencia,
    this.pibPerCapita,
    this.pibAnoReferencia,
  });

  final double? areaTerritorial;
  final String? areaAnoReferencia;
  final int? populacaoUltimoCenso;
  final String? populacaoUltimoCensoAnoReferencia;
  final double? densidadeDemografica;
  final String? densidadeAnoReferencia;
  final int? populacaoEstimada;
  final String? populacaoEstimadaAnoReferencia;
  final double? escolarizacao614;
  final String? escolarizacaoAnoReferencia;
  final double? idhm;
  final String? idhmAnoReferencia;
  final double? mortalidadeInfantil;
  final String? mortalidadeAnoReferencia;
  final double? receitasBrutasRealizadas;
  final String? receitasAnoReferencia;
  final double? despesasBrutasEmpenhadas;
  final String? despesasAnoReferencia;
  final double? pibPerCapita;
  final String? pibAnoReferencia;

  IbgeMunicipioPerfil merge(IbgeMunicipioPerfil? fallback) {
    if (fallback == null) return this;
    return IbgeMunicipioPerfil(
      areaTerritorial: areaTerritorial ?? fallback.areaTerritorial,
      areaAnoReferencia: areaAnoReferencia ?? fallback.areaAnoReferencia,
      populacaoUltimoCenso:
          populacaoUltimoCenso ?? fallback.populacaoUltimoCenso,
      populacaoUltimoCensoAnoReferencia:
          populacaoUltimoCensoAnoReferencia ??
          fallback.populacaoUltimoCensoAnoReferencia,
      densidadeDemografica:
          densidadeDemografica ?? fallback.densidadeDemografica,
      densidadeAnoReferencia:
          densidadeAnoReferencia ?? fallback.densidadeAnoReferencia,
      populacaoEstimada: populacaoEstimada ?? fallback.populacaoEstimada,
      populacaoEstimadaAnoReferencia:
          populacaoEstimadaAnoReferencia ??
          fallback.populacaoEstimadaAnoReferencia,
      escolarizacao614: escolarizacao614 ?? fallback.escolarizacao614,
      escolarizacaoAnoReferencia:
          escolarizacaoAnoReferencia ?? fallback.escolarizacaoAnoReferencia,
      idhm: idhm ?? fallback.idhm,
      idhmAnoReferencia: idhmAnoReferencia ?? fallback.idhmAnoReferencia,
      mortalidadeInfantil: mortalidadeInfantil ?? fallback.mortalidadeInfantil,
      mortalidadeAnoReferencia:
          mortalidadeAnoReferencia ?? fallback.mortalidadeAnoReferencia,
      receitasBrutasRealizadas:
          receitasBrutasRealizadas ?? fallback.receitasBrutasRealizadas,
      receitasAnoReferencia:
          receitasAnoReferencia ?? fallback.receitasAnoReferencia,
      despesasBrutasEmpenhadas:
          despesasBrutasEmpenhadas ?? fallback.despesasBrutasEmpenhadas,
      despesasAnoReferencia:
          despesasAnoReferencia ?? fallback.despesasAnoReferencia,
      pibPerCapita: pibPerCapita ?? fallback.pibPerCapita,
      pibAnoReferencia: pibAnoReferencia ?? fallback.pibAnoReferencia,
    );
  }

  bool get hasAny =>
      areaTerritorial != null ||
      populacaoUltimoCenso != null ||
      densidadeDemografica != null ||
      populacaoEstimada != null ||
      escolarizacao614 != null ||
      idhm != null ||
      mortalidadeInfantil != null ||
      receitasBrutasRealizadas != null ||
      despesasBrutasEmpenhadas != null ||
      pibPerCapita != null;
}

class RelatorioDirigidoBundle {
  const RelatorioDirigidoBundle({
    required this.report,
    this.base,
    this.warning,
  });

  final RelatorioDirigidoMunicipio report;
  final RelatorioDirigidoMunicipio? base;
  final String? warning;
}

class MunicipioIdentificacao {
  const MunicipioIdentificacao({
    required this.municipio,
    required this.municipioNome,
    required this.uf,
    required this.codigoIBGE,
    required this.prefeito,
    required this.partido,
    required this.exercicio,
    required this.fonte,
    required this.mesorregiao,
    required this.microrregiao,
    required this.regiaoIntermediaria,
    required this.regiao,
  });

  final String municipio;
  final String municipioNome;
  final String uf;
  final String codigoIBGE;
  final String prefeito;
  final String partido;
  final int exercicio;
  final String fonte;
  final String mesorregiao;
  final String microrregiao;
  final String regiaoIntermediaria;
  final String regiao;

  factory MunicipioIdentificacao.fromJson(Map<String, dynamic> json) {
    return MunicipioIdentificacao(
      municipio: _readString(json, 'municipio'),
      municipioNome: _readString(json, 'municipioNome'),
      uf: _readString(json, 'uf'),
      codigoIBGE: _readString(json, 'codigoIBGE'),
      prefeito: _readString(json, 'prefeito'),
      partido: _readString(json, 'partido'),
      exercicio: _readInt(json, 'exercicio'),
      fonte: _readString(json, 'fonte'),
      mesorregiao: _readString(json, 'mesorregiao'),
      microrregiao: _readString(json, 'microrregiao'),
      regiaoIntermediaria: _readString(json, 'regiaoIntermediaria'),
      regiao: _readString(json, 'regiao'),
    );
  }
}

class ReceitasFundeb {
  const ReceitasFundeb({
    required this.receitaContribuicaoMunicipal,
    required this.complementacaoVAAF,
    required this.complementacaoVAAT,
    required this.complementacaoVAAR,
    required this.totalReceitas,
  });

  final double receitaContribuicaoMunicipal;
  final double complementacaoVAAF;
  final double complementacaoVAAT;
  final double complementacaoVAAR;
  final double totalReceitas;

  factory ReceitasFundeb.fromJson(Map<String, dynamic> json) {
    return ReceitasFundeb(
      receitaContribuicaoMunicipal: _readDouble(
        json,
        'receitaContribuicaoMunicipal',
      ),
      complementacaoVAAF: _readDouble(json, 'complementacaoVAAF'),
      complementacaoVAAT: _readDouble(json, 'complementacaoVAAT'),
      complementacaoVAAR: _readDouble(json, 'complementacaoVAAR'),
      totalReceitas: _readDouble(json, 'totalReceitas'),
    );
  }
}

class ProjecaoRochaPrime {
  const ProjecaoRochaPrime({
    required this.vaafAtual,
    required this.vaafProjetado,
    required this.vaafGanho,
    required this.vaatAtual,
    required this.vaatProjetado,
    required this.vaatGanho,
    required this.vaarAtual,
    required this.vaarProjetado,
    required this.vaarGanho,
    required this.totalAtual,
    required this.totalProjetado,
    required this.totalGanho,
    required this.ganhoPercentual,
    required this.possuiComplementacao,
    this.metodologia,
    this.multiplicadorAplicado,
    this.natureza,
    this.ressalva,
  });

  final double vaafAtual;
  final double vaafProjetado;
  final double vaafGanho;
  final double vaatAtual;
  final double vaatProjetado;
  final double vaatGanho;
  final double vaarAtual;
  final double vaarProjetado;
  final double vaarGanho;
  final double totalAtual;
  final double totalProjetado;
  final double totalGanho;
  final double ganhoPercentual;
  final bool possuiComplementacao;
  final String? metodologia;
  final double? multiplicadorAplicado;
  final String? natureza;
  final String? ressalva;

  factory ProjecaoRochaPrime.fromJson(Map<String, dynamic> json) {
    return ProjecaoRochaPrime(
      vaafAtual: _readDouble(json, 'vaafAtual'),
      vaafProjetado: _readDouble(json, 'vaafProjetado'),
      vaafGanho: _readDouble(json, 'vaafGanho'),
      vaatAtual: _readDouble(json, 'vaatAtual'),
      vaatProjetado: _readDouble(json, 'vaatProjetado'),
      vaatGanho: _readDouble(json, 'vaatGanho'),
      vaarAtual: _readDouble(json, 'vaarAtual'),
      vaarProjetado: _readDouble(json, 'vaarProjetado'),
      vaarGanho: _readDouble(json, 'vaarGanho'),
      totalAtual: _readDouble(json, 'totalAtual'),
      totalProjetado: _readDouble(json, 'totalProjetado'),
      totalGanho: _readDouble(json, 'totalGanho'),
      ganhoPercentual: _readDouble(json, 'ganhoPercentual'),
      possuiComplementacao: _readBool(json, 'possuiComplementacao'),
      metodologia: _readNullableString(json, 'metodologia'),
      multiplicadorAplicado: _readNullableDouble(json['multiplicadorAplicado']),
      natureza: _readNullableString(json, 'natureza'),
      ressalva: _readNullableString(json, 'ressalva'),
    );
  }
}

class UpsideCondicionadoFundeb {
  const UpsideCondicionadoFundeb({
    required this.totalProjetado,
    required this.ganhoAdicional,
    required this.ganhoPercentual,
    required this.metodologia,
    required this.vetores,
  });

  final double totalProjetado;
  final double ganhoAdicional;
  final double ganhoPercentual;
  final String metodologia;
  final List<String> vetores;

  factory UpsideCondicionadoFundeb.fromJson(Map<String, dynamic> json) {
    return UpsideCondicionadoFundeb(
      totalProjetado: _readDouble(json, 'totalProjetado'),
      ganhoAdicional: _readDouble(json, 'ganhoAdicional'),
      ganhoPercentual: _readDouble(json, 'ganhoPercentual'),
      metodologia: _readString(json, 'metodologia'),
      vetores: _readStringList(json['vetores']),
    );
  }
}

class CronogramaVAAF {
  const CronogramaVAAF({
    required this.mes,
    required this.valorProjetado,
    required this.percentual,
  });

  final String mes;
  final double valorProjetado;
  final double percentual;

  factory CronogramaVAAF.fromJson(Map<String, dynamic> json) {
    return CronogramaVAAF(
      mes: _readString(json, 'mes'),
      valorProjetado: _readDouble(json, 'valorProjetado'),
      percentual: _readDouble(json, 'percentual'),
    );
  }
}

class SistemaHabilitacao {
  const SistemaHabilitacao({
    required this.instituicao,
    required this.sistema,
    required this.situacao,
  });

  final String instituicao;
  final String sistema;
  final String situacao;

  factory SistemaHabilitacao.fromJson(Map<String, dynamic> json) {
    return SistemaHabilitacao(
      instituicao: _readString(json, 'instituicao'),
      sistema: _readString(json, 'sistema'),
      situacao: _readString(json, 'situacao'),
    );
  }
}

class ObraPAC2 {
  const ObraPAC2({
    required this.tipo,
    this.aprovadas,
    this.execucao,
    this.canceladas,
    this.concluidas,
    this.total,
  });

  final String tipo;
  final int? aprovadas;
  final int? execucao;
  final int? canceladas;
  final int? concluidas;
  final int? total;

  factory ObraPAC2.fromJson(Map<String, dynamic> json) {
    return ObraPAC2(
      tipo: _readString(json, 'tipo'),
      aprovadas: _readNullableInt(json['aprovadas']),
      execucao: _readNullableInt(json['execucao']),
      canceladas: _readNullableInt(json['canceladas']),
      concluidas: _readNullableInt(json['concluidas']),
      total: _readNullableInt(json['total']),
    );
  }
}

class VeiculoCaminhoEscola {
  const VeiculoCaminhoEscola({required this.tipo, this.quantidade, this.valor});

  final String tipo;
  final int? quantidade;
  final double? valor;

  factory VeiculoCaminhoEscola.fromJson(Map<String, dynamic> json) {
    return VeiculoCaminhoEscola(
      tipo: _readString(json, 'tipo'),
      quantidade: _readNullableInt(json['quantidade']),
      valor: _readNullableDouble(json['valor']),
    );
  }
}

class RepassePDDE {
  const RepassePDDE({required this.ano, required this.valor});

  final int ano;
  final double valor;

  factory RepassePDDE.fromJson(Map<String, dynamic> json) {
    return RepassePDDE(
      ano: _readInt(json, 'ano'),
      valor: _readDouble(json, 'valor'),
    );
  }
}

class IDEBDado {
  const IDEBDado({required this.ano, this.metaProjetada, this.idebVerificado});

  final int ano;
  final double? metaProjetada;
  final double? idebVerificado;

  factory IDEBDado.fromJson(Map<String, dynamic> json) {
    return IDEBDado(
      ano: _readInt(json, 'ano'),
      metaProjetada: _readNullableDouble(json['metaProjetada']),
      idebVerificado: _readNullableDouble(json['idebVerificado']),
    );
  }
}

class CensoEscolar {
  const CensoEscolar({
    required this.totalEscolas,
    required this.totalMatriculas,
    required this.totalDocentes,
    required this.fonte,
    required this.anoReferencia,
    required this.recorte,
    required this.matriculasEtapa,
    required this.matriculasDetalhadas,
    required this.tempoIntegral,
    required this.docentesCiclo,
  });

  final int totalEscolas;
  final int totalMatriculas;
  final int totalDocentes;
  final String fonte;
  final int? anoReferencia;
  final String recorte;
  final CensoMatriculasEtapa matriculasEtapa;
  final CensoMatriculasDetalhadas matriculasDetalhadas;
  final CensoTempoIntegral tempoIntegral;
  final CensoDocentesCiclo docentesCiclo;

  factory CensoEscolar.fromJson(Map<String, dynamic> json) {
    return CensoEscolar(
      totalEscolas: _readInt(json, 'totalEscolas'),
      totalMatriculas: _readInt(json, 'totalMatriculas'),
      totalDocentes: _readInt(json, 'totalDocentes'),
      fonte: _readString(json, 'fonte'),
      anoReferencia: _readNullableInt(json['anoReferencia']),
      recorte: _readString(json, 'recorte'),
      matriculasEtapa: CensoMatriculasEtapa.fromJson(
        _readMap(json, 'matriculasEtapa'),
      ),
      matriculasDetalhadas: CensoMatriculasDetalhadas.fromJson(
        _readMap(json, 'matriculasDetalhadas'),
      ),
      tempoIntegral: CensoTempoIntegral.fromJson(
        _readMap(json, 'tempoIntegral'),
      ),
      docentesCiclo: CensoDocentesCiclo.fromJson(
        _readMap(json, 'docentesCiclo'),
      ),
    );
  }
}

class CensoMatriculasEtapa {
  const CensoMatriculasEtapa({
    required this.educacaoInfantil,
    required this.ensinoFundamental,
    required this.ensinoMedio,
    required this.eja,
    required this.educacaoEspecial,
  });

  final int educacaoInfantil;
  final int ensinoFundamental;
  final int ensinoMedio;
  final int eja;
  final int educacaoEspecial;

  factory CensoMatriculasEtapa.fromJson(Map<String, dynamic> json) {
    return CensoMatriculasEtapa(
      educacaoInfantil: _readInt(json, 'educacaoInfantil'),
      ensinoFundamental: _readInt(json, 'ensinoFundamental'),
      ensinoMedio: _readInt(json, 'ensinoMedio'),
      eja: _readInt(json, 'eja'),
      educacaoEspecial: _readInt(json, 'educacaoEspecial'),
    );
  }
}

class CensoMatriculasDetalhadas {
  const CensoMatriculasDetalhadas({
    required this.creche,
    required this.preEscola,
    required this.anosIniciais,
    required this.anosFinais,
  });

  final int creche;
  final int preEscola;
  final int anosIniciais;
  final int anosFinais;

  factory CensoMatriculasDetalhadas.fromJson(Map<String, dynamic> json) {
    return CensoMatriculasDetalhadas(
      creche: _readInt(json, 'creche'),
      preEscola: _readInt(json, 'preEscola'),
      anosIniciais: _readInt(json, 'anosIniciais'),
      anosFinais: _readInt(json, 'anosFinais'),
    );
  }
}

class CensoTempoIntegral {
  const CensoTempoIntegral({
    this.total,
    this.educacaoInfantil,
    this.creche,
    this.preEscola,
    this.anosIniciais,
    this.anosFinais,
    this.ensinoFundamental,
    this.ensinoMedio,
    this.eja,
    this.educacaoEspecial,
  });

  final int? total;
  final int? educacaoInfantil;
  final int? creche;
  final int? preEscola;
  final int? anosIniciais;
  final int? anosFinais;
  final int? ensinoFundamental;
  final int? ensinoMedio;
  final int? eja;
  final int? educacaoEspecial;

  factory CensoTempoIntegral.fromJson(Map<String, dynamic> json) {
    return CensoTempoIntegral(
      total: _readNullableInt(json['total']),
      educacaoInfantil: _readNullableInt(json['educacaoInfantil']),
      creche: _readNullableInt(json['creche']),
      preEscola: _readNullableInt(json['preEscola']),
      anosIniciais: _readNullableInt(json['anosIniciais']),
      anosFinais: _readNullableInt(json['anosFinais']),
      ensinoFundamental: _readNullableInt(json['ensinoFundamental']),
      ensinoMedio: _readNullableInt(json['ensinoMedio']),
      eja: _readNullableInt(json['eja']),
      educacaoEspecial: _readNullableInt(json['educacaoEspecial']),
    );
  }
}

class CensoDocentesCiclo {
  const CensoDocentesCiclo({
    required this.fundamentalIniciaisFinais,
    required this.ensinoMedio,
  });

  final int fundamentalIniciaisFinais;
  final int ensinoMedio;

  factory CensoDocentesCiclo.fromJson(Map<String, dynamic> json) {
    return CensoDocentesCiclo(
      fundamentalIniciaisFinais: _readInt(json, 'fundamentalIniciaisFinais'),
      ensinoMedio: _readInt(json, 'ensinoMedio'),
    );
  }
}

class PerfilComercialFundeb {
  const PerfilComercialFundeb({
    required this.score,
    required this.faixa,
    required this.confianca,
    required this.habilitacaoVaat,
    this.populacaoEstimada,
    this.pendenciaVaat,
    this.fundebPerCapita,
    this.matriculasMunicipaisPorHabitante,
    this.educacaoInfantilMunicipalPorHabitante,
    this.crecheMunicipalPorHabitante,
  });

  final double score;
  final String faixa;
  final double confianca;
  final String habilitacaoVaat;
  final int? populacaoEstimada;
  final String? pendenciaVaat;
  final double? fundebPerCapita;
  final double? matriculasMunicipaisPorHabitante;
  final double? educacaoInfantilMunicipalPorHabitante;
  final double? crecheMunicipalPorHabitante;

  factory PerfilComercialFundeb.fromJson(Map<String, dynamic> json) {
    return PerfilComercialFundeb(
      score: _readDouble(json, 'score'),
      faixa: _readString(json, 'faixa'),
      confianca: _readDouble(json, 'confianca'),
      habilitacaoVaat: _readString(json, 'habilitacaoVaat'),
      populacaoEstimada: _readNullableInt(json['populacaoEstimada']),
      pendenciaVaat: _readNullableString(json, 'pendenciaVaat'),
      fundebPerCapita: _readNullableDouble(json['fundebPerCapita']),
      matriculasMunicipaisPorHabitante: _readNullableDouble(
        json['matriculasMunicipaisPorHabitante'],
      ),
      educacaoInfantilMunicipalPorHabitante: _readNullableDouble(
        json['educacaoInfantilMunicipalPorHabitante'],
      ),
      crecheMunicipalPorHabitante: _readNullableDouble(
        json['crecheMunicipalPorHabitante'],
      ),
    );
  }
}

class RelatorioFundeb {
  const RelatorioFundeb({
    required this.geradoEm,
    required this.identificacao,
    required this.receitas,
    required this.projecao,
    required this.projecaoRecuperavel,
    required this.cronogramaVAAF,
    required this.sistemas,
    required this.obrasPAC2,
    required this.situacaoPAR,
    required this.caminhoEscola,
    required this.pdde,
    required this.observacoesOperacionais,
    required this.idebAnosIniciais,
    required this.idebAnosFinais,
    this.projecaoComercial,
    this.upsideCondicionado,
    this.perfilComercial,
    this.censoEscolar,
  });

  final String geradoEm;
  final MunicipioIdentificacao identificacao;
  final ReceitasFundeb receitas;
  final ProjecaoRochaPrime projecao;
  final ProjecaoRochaPrime projecaoRecuperavel;
  final ProjecaoRochaPrime? projecaoComercial;
  final UpsideCondicionadoFundeb? upsideCondicionado;
  final PerfilComercialFundeb? perfilComercial;
  final List<CronogramaVAAF> cronogramaVAAF;
  final List<SistemaHabilitacao> sistemas;
  final List<ObraPAC2> obrasPAC2;
  final String situacaoPAR;
  final List<VeiculoCaminhoEscola> caminhoEscola;
  final List<RepassePDDE> pdde;
  final List<String> observacoesOperacionais;
  final List<IDEBDado> idebAnosIniciais;
  final List<IDEBDado> idebAnosFinais;
  final CensoEscolar? censoEscolar;

  ProjecaoRochaPrime get activeProjection =>
      projecaoComercial ?? projecaoRecuperavel;

  factory RelatorioFundeb.fromJson(Map<String, dynamic> json) {
    return RelatorioFundeb(
      geradoEm: _readString(json, 'geradoEm'),
      identificacao: MunicipioIdentificacao.fromJson(
        _readMap(json, 'identificacao'),
      ),
      receitas: ReceitasFundeb.fromJson(_readMap(json, 'receitas')),
      projecao: ProjecaoRochaPrime.fromJson(_readMap(json, 'projecao')),
      projecaoRecuperavel: ProjecaoRochaPrime.fromJson(
        _readMap(json, 'projecaoRecuperavel'),
      ),
      projecaoComercial: _mapOrNull(
        json['projecaoComercial'],
        ProjecaoRochaPrime.fromJson,
      ),
      upsideCondicionado: _mapOrNull(
        json['upsideCondicionado'],
        UpsideCondicionadoFundeb.fromJson,
      ),
      perfilComercial: _mapOrNull(
        json['perfilComercial'],
        PerfilComercialFundeb.fromJson,
      ),
      cronogramaVAAF: _readList(
        json['cronogramaVAAF'],
        CronogramaVAAF.fromJson,
      ),
      sistemas: _readList(json['sistemas'], SistemaHabilitacao.fromJson),
      obrasPAC2: _readList(json['obrasPAC2'], ObraPAC2.fromJson),
      situacaoPAR: _readString(json, 'situacaoPAR'),
      caminhoEscola: _readList(
        json['caminhoEscola'],
        VeiculoCaminhoEscola.fromJson,
      ),
      pdde: _readList(json['pdde'], RepassePDDE.fromJson),
      observacoesOperacionais: _readStringList(json['observacoesOperacionais']),
      idebAnosIniciais: _readList(json['idebAnosIniciais'], IDEBDado.fromJson),
      idebAnosFinais: _readList(json['idebAnosFinais'], IDEBDado.fromJson),
      censoEscolar: _mapOrNull(json['censoEscolar'], CensoEscolar.fromJson),
    );
  }
}

class RelatorioDirigidoFonte {
  const RelatorioDirigidoFonte({
    required this.url,
    required this.titulo,
    required this.tipo,
  });

  final String url;
  final String titulo;
  final String tipo;

  factory RelatorioDirigidoFonte.fromJson(Map<String, dynamic> json) {
    return RelatorioDirigidoFonte(
      url: _readString(json, 'url'),
      titulo: _readString(json, 'titulo'),
      tipo: _readString(json, 'tipo'),
    );
  }
}

class RelatorioDirigidoItem {
  const RelatorioDirigidoItem({
    required this.id,
    required this.titulo,
    required this.pergunta,
    required this.resposta,
    required this.status,
    required this.confianca,
    required this.fontes,
    required this.observacoes,
  });

  final String id;
  final String titulo;
  final String pergunta;
  final String resposta;
  final String status;
  final int confianca;
  final List<RelatorioDirigidoFonte> fontes;
  final List<String> observacoes;

  factory RelatorioDirigidoItem.fromJson(Map<String, dynamic> json) {
    return RelatorioDirigidoItem(
      id: _readString(json, 'id'),
      titulo: _readString(json, 'titulo'),
      pergunta: _readString(json, 'pergunta'),
      resposta: _readString(json, 'resposta'),
      status: _readString(json, 'status'),
      confianca: _readInt(json, 'confianca'),
      fontes: _readList(json['fontes'], RelatorioDirigidoFonte.fromJson),
      observacoes: _readStringList(json['observacoes']),
    );
  }
}

class RelatorioDirigidoProntidao {
  const RelatorioDirigidoProntidao({
    required this.status,
    required this.score,
    required this.resumo,
    required this.bloqueios,
    required this.avisos,
    required this.criterios,
  });

  final String status;
  final int score;
  final String resumo;
  final List<String> bloqueios;
  final List<String> avisos;
  final List<String> criterios;

  factory RelatorioDirigidoProntidao.fromJson(Map<String, dynamic> json) {
    return RelatorioDirigidoProntidao(
      status: _readString(json, 'status'),
      score: _readInt(json, 'score'),
      resumo: _readString(json, 'resumo'),
      bloqueios: _readStringList(json['bloqueios']),
      avisos: _readStringList(json['avisos']),
      criterios: _readStringList(json['criterios']),
    );
  }
}

class RelatorioDirigidoPerfilMunicipio {
  const RelatorioDirigidoPerfilMunicipio({
    this.populacao,
    this.populacaoAnoReferencia,
  });

  final int? populacao;
  final String? populacaoAnoReferencia;

  factory RelatorioDirigidoPerfilMunicipio.fromJson(Map<String, dynamic> json) {
    return RelatorioDirigidoPerfilMunicipio(
      populacao: _readNullableInt(json['populacao']),
      populacaoAnoReferencia: _readNullableString(
        json,
        'populacaoAnoReferencia',
      ),
    );
  }
}

class RelatorioDirigidoContextoPolitico {
  const RelatorioDirigidoContextoPolitico({
    required this.prefeitoAtual,
    required this.partidoAtual,
    required this.classificacaoMandato,
    required this.detalheMandato,
    required this.estrategiaComercial,
    required this.resumoComparativoGestao,
  });

  final String prefeitoAtual;
  final String partidoAtual;
  final String classificacaoMandato;
  final String detalheMandato;
  final String estrategiaComercial;
  final String resumoComparativoGestao;

  factory RelatorioDirigidoContextoPolitico.fromJson(
    Map<String, dynamic> json,
  ) {
    return RelatorioDirigidoContextoPolitico(
      prefeitoAtual: _readString(json, 'prefeitoAtual'),
      partidoAtual: _readString(json, 'partidoAtual'),
      classificacaoMandato: _readString(json, 'classificacaoMandato'),
      detalheMandato: _readString(json, 'detalheMandato'),
      estrategiaComercial: _readString(json, 'estrategiaComercial'),
      resumoComparativoGestao: _readString(json, 'resumoComparativoGestao'),
    );
  }
}

class RelatorioDirigidoSerieHistoricaAno {
  const RelatorioDirigidoSerieHistoricaAno({
    required this.ano,
    this.anoBaseCenso,
    this.totalReceitasFundeb,
    this.contribuicaoMunicipal,
    this.complementacaoVAAF,
    this.complementacaoVAAT,
    this.complementacaoVAAR,
    this.totalMatriculas,
    this.totalEscolas,
    this.eja,
    this.tempoIntegral,
    this.educacaoEspecial,
  });

  final int ano;
  final int? anoBaseCenso;
  final double? totalReceitasFundeb;
  final double? contribuicaoMunicipal;
  final double? complementacaoVAAF;
  final double? complementacaoVAAT;
  final double? complementacaoVAAR;
  final int? totalMatriculas;
  final int? totalEscolas;
  final int? eja;
  final int? tempoIntegral;
  final int? educacaoEspecial;

  factory RelatorioDirigidoSerieHistoricaAno.fromJson(
    Map<String, dynamic> json,
  ) {
    return RelatorioDirigidoSerieHistoricaAno(
      ano: _readInt(json, 'ano'),
      anoBaseCenso: _readNullableInt(json['anoBaseCenso']),
      totalReceitasFundeb: _readNullableDouble(json['totalReceitasFundeb']),
      contribuicaoMunicipal: _readNullableDouble(json['contribuicaoMunicipal']),
      complementacaoVAAF: _readNullableDouble(json['complementacaoVAAF']),
      complementacaoVAAT: _readNullableDouble(json['complementacaoVAAT']),
      complementacaoVAAR: _readNullableDouble(json['complementacaoVAAR']),
      totalMatriculas: _readNullableInt(json['totalMatriculas']),
      totalEscolas: _readNullableInt(json['totalEscolas']),
      eja: _readNullableInt(json['eja']),
      tempoIntegral: _readNullableInt(json['tempoIntegral']),
      educacaoEspecial: _readNullableInt(json['educacaoEspecial']),
    );
  }
}

class RelatorioDirigidoHistorico {
  const RelatorioDirigidoHistorico({required this.anos, required this.resumo});

  final List<RelatorioDirigidoSerieHistoricaAno> anos;
  final String resumo;

  factory RelatorioDirigidoHistorico.fromJson(Map<String, dynamic> json) {
    return RelatorioDirigidoHistorico(
      anos: _readList(
        json['anos'],
        RelatorioDirigidoSerieHistoricaAno.fromJson,
      ),
      resumo: _readString(json, 'resumo'),
    );
  }
}

class RelatorioDirigidoMunicipioComparavel {
  const RelatorioDirigidoMunicipioComparavel({
    required this.municipio,
    required this.uf,
    required this.codigoIbge,
    required this.criterioRegional,
    required this.mesmaFaixaPopulacional,
    required this.insight,
    this.populacao,
    this.totalReceitasFundeb,
    this.totalMatriculas,
    this.complementacaoUniaoTotal,
    this.vantagemReceita,
    this.vantagemComplementacao,
  });

  final String municipio;
  final String uf;
  final String codigoIbge;
  final String criterioRegional;
  final bool mesmaFaixaPopulacional;
  final String insight;
  final int? populacao;
  final double? totalReceitasFundeb;
  final int? totalMatriculas;
  final double? complementacaoUniaoTotal;
  final double? vantagemReceita;
  final double? vantagemComplementacao;

  factory RelatorioDirigidoMunicipioComparavel.fromJson(
    Map<String, dynamic> json,
  ) {
    return RelatorioDirigidoMunicipioComparavel(
      municipio: _readString(json, 'municipio'),
      uf: _readString(json, 'uf'),
      codigoIbge: _readString(json, 'codigoIbge'),
      criterioRegional: _readString(json, 'criterioRegional'),
      mesmaFaixaPopulacional: _readBool(json, 'mesmaFaixaPopulacional'),
      insight: _readString(json, 'insight'),
      populacao: _readNullableInt(json['populacao']),
      totalReceitasFundeb: _readNullableDouble(json['totalReceitasFundeb']),
      totalMatriculas: _readNullableInt(json['totalMatriculas']),
      complementacaoUniaoTotal: _readNullableDouble(
        json['complementacaoUniaoTotal'],
      ),
      vantagemReceita: _readNullableDouble(json['vantagemReceita']),
      vantagemComplementacao: _readNullableDouble(
        json['vantagemComplementacao'],
      ),
    );
  }
}

class RelatorioDirigidoBenchmarkRegional {
  const RelatorioDirigidoBenchmarkRegional({
    required this.criterio,
    required this.resumo,
    required this.municipios,
  });

  final String criterio;
  final String resumo;
  final List<RelatorioDirigidoMunicipioComparavel> municipios;

  factory RelatorioDirigidoBenchmarkRegional.fromJson(
    Map<String, dynamic> json,
  ) {
    return RelatorioDirigidoBenchmarkRegional(
      criterio: _readString(json, 'criterio'),
      resumo: _readString(json, 'resumo'),
      municipios: _readList(
        json['municipios'],
        RelatorioDirigidoMunicipioComparavel.fromJson,
      ),
    );
  }
}

class RelatorioDirigidoMunicipio {
  const RelatorioDirigidoMunicipio({
    required this.municipio,
    required this.uf,
    required this.codigoIbge,
    required this.geradoEm,
    required this.modo,
    required this.modeloPrincipal,
    required this.resumoExecutivo,
    required this.searchQueries,
    required this.itens,
    required this.pendenciasHumanas,
    required this.alertasJuridicos,
    required this.proximosPassos,
    required this.prontidao,
    required this.contextoPolitico,
    required this.historico,
    required this.benchmarkRegional,
    this.modeloAuxiliar,
    this.perfilMunicipio,
  });

  final String municipio;
  final String uf;
  final String codigoIbge;
  final String geradoEm;
  final String modo;
  final String modeloPrincipal;
  final String? modeloAuxiliar;
  final String resumoExecutivo;
  final List<String> searchQueries;
  final List<RelatorioDirigidoItem> itens;
  final List<String> pendenciasHumanas;
  final List<String> alertasJuridicos;
  final List<String> proximosPassos;
  final RelatorioDirigidoProntidao prontidao;
  final RelatorioDirigidoPerfilMunicipio? perfilMunicipio;
  final RelatorioDirigidoContextoPolitico contextoPolitico;
  final RelatorioDirigidoHistorico historico;
  final RelatorioDirigidoBenchmarkRegional benchmarkRegional;

  factory RelatorioDirigidoMunicipio.fromJson(Map<String, dynamic> json) {
    return RelatorioDirigidoMunicipio(
      municipio: _readString(json, 'municipio'),
      uf: _readString(json, 'uf'),
      codigoIbge: _readString(json, 'codigoIbge'),
      geradoEm: _readString(json, 'geradoEm'),
      modo: _readString(json, 'modo'),
      modeloPrincipal: _readString(json, 'modeloPrincipal'),
      modeloAuxiliar: _readNullableString(json, 'modeloAuxiliar'),
      resumoExecutivo: _readString(json, 'resumoExecutivo'),
      searchQueries: _readStringList(json['searchQueries']),
      itens: _readList(json['itens'], RelatorioDirigidoItem.fromJson),
      pendenciasHumanas: _readStringList(json['pendenciasHumanas']),
      alertasJuridicos: _readStringList(json['alertasJuridicos']),
      proximosPassos: _readStringList(json['proximosPassos']),
      prontidao: RelatorioDirigidoProntidao.fromJson(
        _readMap(json, 'prontidao'),
      ),
      perfilMunicipio: _mapOrNull(
        json['perfilMunicipio'],
        RelatorioDirigidoPerfilMunicipio.fromJson,
      ),
      contextoPolitico: RelatorioDirigidoContextoPolitico.fromJson(
        _readMap(json, 'contextoPolitico'),
      ),
      historico: RelatorioDirigidoHistorico.fromJson(
        _readMap(json, 'historico'),
      ),
      benchmarkRegional: RelatorioDirigidoBenchmarkRegional.fromJson(
        _readMap(json, 'benchmarkRegional'),
      ),
    );
  }
}

class FonteColetaStatus {
  const FonteColetaStatus({
    required this.id,
    required this.label,
    required this.status,
    required this.descricao,
  });

  final String id;
  final String label;
  final String status;
  final String descricao;
}

Map<String, dynamic> _readMap(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is Map<String, dynamic>) return value;
  return <String, dynamic>{};
}

String _readString(Map<String, dynamic> json, String key) {
  return _readNullableString(json, key) ?? '';
}

String? _readNullableString(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value == null) return null;
  final normalized = value.toString().trim();
  return normalized.isEmpty ? null : normalized;
}

int _readInt(Map<String, dynamic> json, String key) {
  return _readNullableInt(json[key]) ?? 0;
}

int? _readNullableInt(dynamic value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is double) return value.round();
  return int.tryParse(value.toString());
}

double _readDouble(Map<String, dynamic> json, String key) {
  return _readNullableDouble(json[key]) ?? 0;
}

double? _readNullableDouble(dynamic value) {
  if (value == null) return null;
  if (value is num) return value.toDouble();
  final raw = value.toString().trim();
  if (raw.isEmpty) return null;
  final normalized = raw.contains(',')
      ? raw.replaceAll('.', '').replaceAll(',', '.')
      : raw;
  return double.tryParse(normalized);
}

bool _readBool(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is bool) return value;
  if (value is num) return value != 0;
  return value.toString().toLowerCase() == 'true';
}

List<String> _readStringList(dynamic value) {
  if (value is! List) return const <String>[];
  return value
      .map((item) => item.toString())
      .where((item) => item.isNotEmpty)
      .toList();
}

List<T> _readList<T>(
  dynamic value,
  T Function(Map<String, dynamic> json) fromJson,
) {
  if (value is! List) return <T>[];
  return value.whereType<Map<String, dynamic>>().map(fromJson).toList();
}

T? _mapOrNull<T>(
  dynamic value,
  T Function(Map<String, dynamic> json) fromJson,
) {
  if (value is! Map<String, dynamic>) return null;
  return fromJson(value);
}
