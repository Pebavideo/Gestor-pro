import { LegalPageLayout } from "@/components/LegalPageLayout";

export default function Privacy() {
  return (
    <LegalPageLayout title="Politica de Privacidade" updatedAt="13 de agosto de 2026">
      <p>
        Esta Politica de Privacidade descreve como o <strong>Gestor Pro</strong> ("nos",
        "nosso" ou "Plataforma") coleta, usa, armazena e protege os dados pessoais e
        comerciais de seus usuarios ("voce", "lojista" ou "titular"), em conformidade
        com a Lei Geral de Protecao de Dados Pessoais (Lei no 13.709/2018 - LGPD).
      </p>

      <h2>1. Quais dados coletamos</h2>
      <p>Para operar o Gestor Pro, coletamos e tratamos as seguintes categorias de dados:</p>
      <ul>
        <li>
          <strong>Dados de cadastro:</strong> nome, sobrenome, e-mail, senha (armazenada de
          forma criptografada pelo Firebase Authentication), CNPJ/CPF e razao
          social/nome da empresa, quando informados.
        </li>
        <li>
          <strong>Dados operacionais e financeiros:</strong> transacoes (receitas e
          despesas), produtos e estoque, funcionarios e folha de pagamento, metas de
          impostos e relatorios gerados dentro da sua conta.
        </li>
        <li>
          <strong>Imagens:</strong> fotos de perfil e outras imagens que voce optar por
          enviar, sempre compactadas automaticamente antes do envio (veja a secao 4).
        </li>
        <li>
          <strong>Dados tecnicos:</strong> informacoes de autenticacao (tokens de sessao do
          Firebase Authentication) necessarias para manter voce conectado com seguranca.
        </li>
      </ul>

      <h2>2. Como armazenamos seus dados</h2>
      <p>
        Todos os dados do Gestor Pro sao armazenados na infraestrutura do{" "}
        <strong>Firebase / Google Cloud Platform</strong>: os dados estruturados
        (transacoes, produtos, funcionarios, configuracoes) ficam no{" "}
        <strong>Firestore</strong>, a autenticacao e feita pelo{" "}
        <strong>Firebase Authentication</strong>, e as imagens enviadas ficam no{" "}
        <strong>Firebase Storage</strong>. Essa infraestrutura utiliza criptografia em
        transito e em repouso, controles de acesso restritos e os padroes de seguranca
        do Google Cloud.
      </p>
      <p>
        O acesso aos dados dentro da Plataforma e controlado por papeis de usuario
        (Master, Gerente e Operador) e, quando aplicavel, por unidade/loja - cada
        lojista so acessa os dados da propria conta e das lojas as quais tem permissao
        de acesso.
      </p>

      <h2>3. Compactador de imagens</h2>
      <p>
        Sempre que voce envia uma imagem (por exemplo, uma foto de perfil), o Gestor Pro
        aplica automaticamente um <strong>compactador de imagens</strong> antes do
        upload para o Firebase Storage. Isso reduz o tamanho dos arquivos armazenados,
        diminui o consumo de dados e ajuda a manter sua conta dentro dos limites de uso
        do Firestore/Storage, sem reduzir de forma perceptivel a qualidade da imagem
        para uso no sistema. Essa etapa e obrigatoria e nao pode ser desativada pelo
        usuario.
      </p>

      <h2>4. Sigilo dos dados comerciais e das vendas</h2>
      <p>
        Reconhecemos que informacoes de vendas, produtos, precos, estoque e
        faturamento sao <strong>dados comercialmente sensiveis</strong> do seu negocio.
        O Gestor Pro trata esses dados com sigilo: eles nunca sao compartilhados com
        outros lojistas, nunca sao usados para fins de benchmarking publico ou
        divulgados a terceiros sem sua autorizacao expressa, e ficam visiveis somente
        para os usuarios que voce mesmo autorizar dentro da sua conta (por meio dos
        papeis Master, Gerente e Operador).
      </p>

      <h2>5. Compartilhamento de dados com terceiros</h2>
      <p>
        Nao vendemos nem alugamos seus dados pessoais ou comerciais. Os unicos
        terceiros envolvidos no processamento de dados sao nossos provedores de
        infraestrutura (Firebase/Google Cloud), que atuam como operadores de dados nos
        termos da LGPD, processando informacoes exclusivamente para viabilizar o
        funcionamento da Plataforma. Podemos divulgar dados quando exigido por lei, ordem
        judicial ou autoridade competente.
      </p>

      <h2>6. Seus direitos como titular de dados (LGPD)</h2>
      <p>Nos termos da LGPD, voce tem direito a:</p>
      <ul>
        <li>Confirmar a existencia de tratamento dos seus dados;</li>
        <li>Acessar os dados que temos sobre voce;</li>
        <li>Corrigir dados incompletos, inexatos ou desatualizados;</li>
        <li>Solicitar a anonimizacao, bloqueio ou eliminacao de dados desnecessarios;</li>
        <li>Solicitar a portabilidade dos seus dados a outro fornecedor de servico;</li>
        <li>Solicitar a exclusao dos dados pessoais tratados com o seu consentimento;</li>
        <li>Revogar o consentimento a qualquer momento.</li>
      </ul>
      <p>
        Voce pode exercer a maior parte desses direitos diretamente no seu perfil dentro
        do sistema (edicao de dados cadastrais) ou entrando em contato pelos canais
        indicados na secao 9.
      </p>

      <h2>7. Retencao e exclusao de dados</h2>
      <p>
        Mantemos seus dados enquanto sua conta estiver ativa e pelo tempo necessario
        para cumprir obrigacoes legais, fiscais e contratuais. Ao solicitar o
        encerramento da conta, seus dados sao excluidos ou anonimizados, exceto quando
        a legislacao exigir a retencao por um periodo adicional (por exemplo,
        obrigacoes fiscais e contabeis).
      </p>

      <h2>8. Seguranca da informacao</h2>
      <p>
        Adotamos medidas tecnicas e organizacionais para proteger seus dados contra
        acesso nao autorizado, perda, alteracao ou destruicao, incluindo autenticacao
        segura, controle de acesso por papel/loja e uso da infraestrutura segura do
        Firebase. Ainda assim, nenhum sistema e 100% imune a incidentes - caso algum
        incidente de seguranca relevante ocorra, voce sera notificado conforme exigido
        pela LGPD.
      </p>

      <h2>9. Contato</h2>
      <p>
        Duvidas, solicitacoes relacionadas aos seus dados pessoais ou exercicio dos
        direitos previstos na LGPD podem ser enviadas para o e-mail de suporte
        informado dentro do sistema ou diretamente ao responsavel pela sua conta
        Gestor Pro.
      </p>

      <h2>10. Alteracoes desta politica</h2>
      <p>
        Esta Politica de Privacidade pode ser atualizada periodicamente para refletir
        melhorias no sistema ou mudancas legais. A data da ultima atualizacao esta
        sempre indicada no topo desta pagina.
      </p>
    </LegalPageLayout>
  );
}
