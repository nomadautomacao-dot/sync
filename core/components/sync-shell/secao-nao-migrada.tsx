"use client";

import Link from "next/link";
import { Button, Result, Typography } from "antd";

interface SecaoNaoMigradaProps {
  /** Nome da seção como aparece na navegação. */
  titulo: string;
  /** O que a seção deve fazer quando existir, em uma frase. */
  resumo: string;
  /**
   * Conteúdo que a seção **já** oferece, apesar de não ter sido migrada.
   * Renderiza abaixo do aviso. Usado por Ajustes, que ainda é placeholder mas
   * já hospeda ferramentas de desenvolvimento.
   */
  children?: React.ReactNode;
}

/**
 * Tela das seções que ainda não foram construídas.
 *
 * Existe para que a navegação inteira seja percorrível: o usuário clica em
 * qualquer item da sidebar, o shell responde, e a tela diz com honestidade que
 * aquela parte ainda não existe — em vez de dar 404. `Result` é o componente
 * do Ant para exatamente esse tipo de estado (vazio/erro/aviso "de página
 * inteira"), então a apresentação passou a ser dele.
 *
 * Usada hoje por `/ajustes` e `/caixa`. Não é andaime esquecido: é o marcador
 * do trabalho que falta, e some quando a seção for construída.
 */
export function SecaoNaoMigrada({ titulo, resumo, children }: SecaoNaoMigradaProps) {
  return (
    <Result
      status="info"
      title={titulo}
      subTitle={resumo}
      extra={
        <Link href="/painel">
          <Button type="primary">Voltar ao painel</Button>
        </Link>
      }
    >
      <Typography.Paragraph type="secondary" style={{ textAlign: "center" }}>
        Esta seção ainda não foi construída na interface nova. A versão anterior vivia no app
        Flutter, que foi removido do repositório — a referência, se precisar dela, está no
        histórico do git.
      </Typography.Paragraph>

      {children}
    </Result>
  );
}
