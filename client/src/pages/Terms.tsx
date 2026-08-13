import { LegalPageLayout } from "@/components/LegalPageLayout";

export default function Terms() {
  return (
    <LegalPageLayout title="Termos de Uso" updatedAt="13 de agosto de 2026">
      <p>
        Estes Termos de Uso regulam o acesso e a utilizacao do{" "}
        <strong>Gestor Pro</strong> ("Plataforma"), um sistema de gestao financeira e
        operacional para negocios. Ao criar uma conta ou utilizar a Plataforma, voce
        declara que leu, compreendeu e concorda com estes Termos e com a nossa{" "}
        <a href="/privacidade">Politica de Privacidade</a>.
      </p>

      <h2>1. Descricao do servico</h2>
      <p>
        O Gestor Pro e uma ferramenta de gestao empresarial que permite controlar
        transacoes financeiras (contas a pagar e receber), gerar o DRE (Demonstrativo
        de Resultado do Exercicio), cadastrar produtos e estoque, gerenciar equipe e
        folha de pagamento, e organizar operacoes por unidade/loja, com dados
        armazenados de forma segura no Firebase.
      </p>

      <h2>2. Cadastro e conta</h2>
      <p>
        Para usar o Gestor Pro voce deve se cadastrar com um e-mail valido e confirmar
        sua identidade por meio do codigo de verificacao enviado ao criar a conta. Voce
        e responsavel por manter a confidencialidade da sua senha e por todas as
        atividades realizadas na sua conta. Informe-nos imediatamente em caso de uso
        nao autorizado.
      </p>

      <h2>3. Papeis de acesso e uso multi-loja</h2>
      <p>
        A Plataforma opera com tres niveis de acesso: <strong>Master</strong> (acesso
        total, gerencia usuarios e configuracoes), <strong>Gerente</strong> (gestao
        operacional dentro da(s) unidade(s) atribuida(s)) e{" "}
        <strong>Operador</strong> (uso restrito, principalmente lancamento de
        transacoes). O usuario Master e responsavel por atribuir corretamente os
        papeis e unidades dos demais usuarios da sua conta.
      </p>

      <h2>4. Uso adequado</h2>
      <p>Ao utilizar o Gestor Pro, voce concorda em nao:</p>
      <ul>
        <li>Utilizar a Plataforma para fins ilegais, fraudulentos ou nao autorizados;</li>
        <li>Tentar acessar dados de outras contas/lojistas sem autorizacao;</li>
        <li>Tentar burlar, sobrecarregar ou comprometer a seguranca do sistema;</li>
        <li>
          Fazer engenharia reversa, copiar ou redistribuir o codigo ou a estrutura da
          Plataforma sem autorizacao.
        </li>
      </ul>

      <h2>5. Seus dados e conteudo</h2>
      <p>
        Todos os dados financeiros, comerciais e de estoque inseridos por voce
        continuam sendo de sua propriedade. O Gestor Pro atua apenas como
        processador/armazenador dessas informacoes na infraestrutura do Firebase, nos
        termos da nossa <a href="/privacidade">Politica de Privacidade</a>, e nao
        reivindica propriedade sobre o conteudo que voce cadastra.
      </p>
      <p>
        Imagens enviadas (como foto de perfil) passam por compactacao automatica antes
        do armazenamento, conforme detalhado na Politica de Privacidade.
      </p>

      <h2>6. Disponibilidade do servico</h2>
      <p>
        Nos esforcamos para manter o Gestor Pro disponivel e funcionando corretamente,
        mas nao garantimos operacao ininterrupta ou livre de erros, uma vez que a
        Plataforma depende de servicos de terceiros (Firebase/Google Cloud). Podemos
        realizar manutencoes programadas ou emergenciais que afetem temporariamente a
        disponibilidade do sistema.
      </p>

      <h2>7. Limitacao de responsabilidade</h2>
      <p>
        O Gestor Pro e uma ferramenta de apoio a gestao e nao substitui aconselhamento
        contabil, fiscal ou juridico profissional. Voce e o unico responsavel pela
        exatidao dos dados inseridos e pelas decisoes de negocio tomadas com base nos
        relatorios gerados pela Plataforma (incluindo calculos de impostos e DRE), que
        tem carater informativo.
      </p>

      <h2>8. Cancelamento e encerramento de conta</h2>
      <p>
        Voce pode solicitar o encerramento da sua conta a qualquer momento. Reservamo-nos
        o direito de suspender ou encerrar contas que violem estes Termos, mediante
        aviso previo sempre que possivel, exceto em casos de violacao grave ou risco a
        seguranca da Plataforma.
      </p>

      <h2>9. Alteracoes destes termos</h2>
      <p>
        Podemos atualizar estes Termos de Uso periodicamente. Alteracoes relevantes
        serao comunicadas dentro da Plataforma. O uso continuado do Gestor Pro apos uma
        atualizacao implica concordancia com os novos termos.
      </p>

      <h2>10. Legislacao aplicavel</h2>
      <p>
        Estes Termos sao regidos pelas leis da Republica Federativa do Brasil,
        incluindo a Lei Geral de Protecao de Dados (LGPD - Lei no 13.709/2018). Fica
        eleito o foro do domicilio do lojista para dirimir eventuais controversias,
        salvo disposicao legal em contrario.
      </p>

      <h2>11. Contato</h2>
      <p>
        Duvidas sobre estes Termos de Uso podem ser enviadas pelos canais de suporte
        indicados dentro do sistema.
      </p>
    </LegalPageLayout>
  );
}
