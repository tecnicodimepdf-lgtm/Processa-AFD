import { useState } from "react";
import { 
  FileSpreadsheet, Cpu, BookOpen, Clock, Copy, Check, Info, ShieldAlert, FileText, ChevronRight, HelpCircle
} from "lucide-react";

export default function UserGuideView() {
  const [copiedCSV, setCopiedCSV] = useState(false);
  const [copiedIPCSV, setCopiedIPCSV] = useState(false);

  const sampleCSV = `codigo;relogio;fabricacao;ip
1;BIG TRANS - RECANTO;00047005860040681;192.168.10.20
2;RECEPCAO PRINCIPAL;00047005860045544;192.168.10.21
3;PORTARIA AUXILIAR;00047005860047777;192.168.12.5`;

  const sampleCommaCSV = `codigo,relogio,fabricacao,ip
10A,RECEPÇÃO BLOCO A,00047005860040681,192.168.1.100
10B,EXPEDIÇÃO SUL,00047005860045544,192.168.1.101`;

  const handleCopyText = (text: string, setter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Welcome Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-lg p-6 md:p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 opacity-10 pointer-events-none">
          <BookOpen className="w-64 h-64 text-white" />
        </div>
        
        <div className="relative z-10 max-w-3xl space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider bg-blue-500/20 text-blue-300 uppercase border border-blue-500/30">
            <Info className="h-3 w-3" />
            <span>Guia Oficial de Treinamento</span>
          </span>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">Manual Operacional do Splitter de Ponto SRE</h2>
          <p className="text-slate-300 text-xs md:text-sm leading-relaxed">
            Este manual detalha de ponta a ponta como estruturar o seu arquivo de mapeamento de relógios de ponto, os bastidores de preservação byte-accurate exigidos pelas Portarias Ministério do Trabalho, e as melhores práticas do sistema.
          </p>
        </div>
      </div>

      {/* Grid: Instructions Column & Collapsible Navigation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Deep Instructions Panel (Takes 2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Section 1: CSV Modeling */}
          <section className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-150 pb-3">
              <div className="p-1.5 rounded bg-blue-50 text-blue-600">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                  1. Mapeamento de Relógios (Tabela CSV)
                </h3>
                <p className="text-[10px] text-gray-400">Instruções de estrutura e formatação da sua planilha relogios.csv</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Para fatiar o seu arquivo AFD unificado, o processador busca o número de fabricação de 17 dígitos em cada batida e o confronta com a planilha de equipamentos cadastrados. Você pode utilizar o Microsoft Excel, LibreOffice Calc, ou Google Sheets e salvar como <strong>CSV UTF-8 (separado por vírgulas ou ponto e vírgulas)</strong>.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded p-4 text-[11px] text-amber-900 leading-relaxed flex gap-2.5">
              <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-amber-800">Definição das Colunas (Importação Tolerante):</strong>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li><strong>Código:</strong> Código resumido ou ID para prefixar o arquivo final. (Ex: <code className="bg-amber-100 font-semibold px-0.5 rounded">1</code>, <code className="bg-amber-100 font-semibold px-0.5 rounded">REC_02</code>).</li>
                  <li><strong>Relógio/Nome:</strong> Nome social amigável do relógio de ponto. (Ex: <code className="bg-amber-100 font-semibold px-0.5 rounded">BIG TRANS - RECANTO</code>).</li>
                  <li><strong>Fabricação:</strong> O número de série de <strong className="underline">17 dígitos</strong> gravado no relógio. (Ex: <code className="bg-amber-100 font-semibold px-0.5 rounded">00047005860040681</code>).</li>
                  <li><strong>IP (Opcional):</strong> Endereço de rede do relógio para fins cadastrais.</li>
                </ul>
              </div>
            </div>

            {/* Sub: CSV Templates with Copy Action */}
            <div className="space-y-3">
              <h4 className="text-[11px] font-bold text-gray-700 uppercase tracking-widest flex items-center gap-1.5">
                <ChevronRight className="h-3.5 w-3.5 text-blue-500" />
                <span>Modelo de CSV (Separador Ponto e Vírgula - Excel Brasil)</span>
              </h4>
              
              <div className="relative rounded border border-gray-200 bg-gray-50 p-3.5 font-mono text-xs text-gray-800 leading-relaxed">
                <button
                  type="button"
                  onClick={() => handleCopyText(sampleCSV, setCopiedCSV)}
                  className="absolute right-2 top-2 p-1.5 rounded bg-white hover:bg-gray-100 border border-gray-200 hover:border-gray-200.5 text-gray-500 hover:text-gray-900 transition flex items-center gap-1 text-[10px] uppercase font-sans font-bold shadow-sm"
                  title="Copiar Modelo"
                >
                  {copiedCSV ? (
                    <>
                      <Check className="h-3 w-3 text-green-600" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
                <pre className="overflow-x-auto whitespace-pre pr-20">{sampleCSV}</pre>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <h4 className="text-[11px] font-bold text-gray-700 uppercase tracking-widest flex items-center gap-1.5">
                <ChevronRight className="h-3.5 w-3.5 text-blue-500" />
                <span>Modelo de CSV (Separador Vírgula - Padrão Internacional)</span>
              </h4>
              
              <div className="relative rounded border border-gray-200 bg-gray-50 p-3.5 font-mono text-xs text-gray-800 leading-relaxed">
                <button
                  type="button"
                  onClick={() => handleCopyText(sampleCommaCSV, setCopiedIPCSV)}
                  className="absolute right-2 top-2 p-1.5 rounded bg-white hover:bg-gray-100 border border-gray-200 hover:border-gray-200.5 text-gray-500 hover:text-gray-900 transition flex items-center gap-1 text-[10px] uppercase font-sans font-bold shadow-sm"
                  title="Copiar Modelo"
                >
                  {copiedIPCSV ? (
                    <>
                      <Check className="h-3 w-3 text-green-600" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
                <pre className="overflow-x-auto whitespace-pre pr-20">{sampleCommaCSV}</pre>
              </div>
            </div>
          </section>

          {/* Section 2: Process details */}
          <section className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-150 pb-3">
              <div className="p-1.5 rounded bg-blue-50 text-blue-600">
                <Cpu className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                  2. Fluxograma de Divisão SRE e Validade Digital
                </h3>
                <p className="text-[10px] text-gray-400">Como asseguramos que o arquivo não falhe no sistema de RH secundário</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              O processamento do AFD consolidador respeita rigorosamente os padrões de preservação digital de logs, essencial para perícias trabalhistas segundo o MTE.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-600">
              <div className="p-3 bg-slate-50 border border-slate-150 rounded space-y-1">
                <span className="font-bold text-gray-900 block flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                  <span>Cabeçalho Portaria (Tipo 1)</span>
                </span>
                <p className="text-[11px] text-gray-500 leading-normal">
                  Todo arquivo segmentado herda obrigatoriamente a linha de Cabeçalho (identificação da empresa, CNPJ, razão social) do arquivo-mãe. Sem ela, os softwares de RH rejeitam a importação.
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-150 rounded space-y-1">
                <span className="font-bold text-gray-900 block flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                  <span>Rodapé Consolidado (Tipo 9)</span>
                </span>
                <p className="text-[11px] text-gray-500 leading-normal">
                  A última linha do AFD (registro Tipo 9) estipula a integridade e contador de linhas. O fatiador do Splitter gera o Tipo 9 individual correto de quantidade de batidas lidas para aquele segmento.
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-150 rounded space-y-1">
                <span className="font-bold text-gray-900 block flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                  <span>Preservação do Caractere nulo</span>
                </span>
                <p className="text-[11px] text-gray-500 leading-normal">
                  Sistemas biométricos gravam batidas no padrão Windows <code className="bg-gray-150 text-[9px] px-0.5 rounded font-mono font-semibold">\r\n</code> ou Linux <code className="bg-gray-150 text-[9px] px-0.5 rounded font-mono font-semibold">\n</code>. O nosso motor preserva intactos os bytes originais de quebra.
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-150 rounded space-y-1">
                <span className="font-bold text-gray-900 block flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                  <span>Mapeamento Desconhecido</span>
                </span>
                <p className="text-[11px] text-gray-500 leading-normal">
                  Relógios cujos números de série não constam no seu CSV de equipamentos catalogados são separados em arquivos individuais chamados <code className="bg-amber-100/70 text-amber-800 text-[9px] px-0.5 rounded font-mono font-semibold">RELOGIO_DESCONHECIDO_[serie].txt</code>.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3: Pro Tips and Tricks */}
          <section className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-150 pb-3">
              <div className="p-1.5 rounded bg-blue-50 text-blue-600">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                  3. Dicas Comentadas de Uso do Sistema
                </h3>
                <p className="text-[10px] text-gray-400">Melhores práticas para acelerar o seu fluxo semanal de divisão</p>
              </div>
            </div>

            <div className="space-y-4 text-xs text-gray-600">
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">💡</div>
                <div>
                  <h4 className="font-bold text-gray-900">Importação por Arraste Rápido (Drag & Drop)</h4>
                  <p className="text-gray-500 mt-0.5 leading-relaxed">
                    Você não precisa ficar preenchendo formulários um por um! Arraste o seu arquivo <code className="font-mono bg-gray-50 px-1 py-0.5 rounded text-gray-700 font-semibold text-[10px]">relogios.csv</code> diretamente na zona tracejada da aba de Cadastro. O sistema se encarrega de ler e parsear todas as colunas em milesegundos.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5 font-sans">💡</div>
                <div>
                  <h4 className="font-bold text-gray-900">Uso do Pacote ZIP em Lote</h4>
                  <p className="text-gray-500 mt-0.5 leading-relaxed">
                    Caso o seu consolidado gere 10, 20, ou mais arquivos individuais separados, em vez de salvar um por um repetidamente, use o botão <strong>"Baixar Tudo (ZIP Compactado)"</strong>. O sistema empacotará de forma nativa e limpa todos os relógios processados em um único arquivo de compressão.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5 font-sans">💡</div>
                <div>
                  <h4 className="font-bold text-gray-900">Privacidade Absoluta de Dados</h4>
                  <p className="text-gray-500 mt-0.5 leading-relaxed">
                    A segurança corporativa é o pilar deste utilitário. Toda a leitura de CPFs, identificadores de crachás, batimentos biométricos e logs sensíveis é processada <strong>localmente dentro do seu próprio browser</strong>. Nenhum dado de funcionário é transmitido ao servidor remoto para realizar a operação.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5 font-sans">💡</div>
                <div>
                  <h4 className="font-bold text-gray-900">Automação de Retaguarda com Script Python</h4>
                  <p className="text-gray-500 mt-0.5 leading-relaxed">
                    Para administradores de rede ou profissionais do RH corporativo mais técnico, copie o código fornecido na aba <strong>"Código Python"</strong>. Ele mapeia os mesmos comportamentos do sistema visual em uma ferramenta leve de terminal que pode ser disparada através de um script de inicialização ou agendador de tarefas automatizado.
                  </p>
                </div>
              </div>
            </div>
          </section>

        </div>

        {/* Right Side: Quick FAQ & Stats Accordion (Takes 1 Col) */}
        <div className="space-y-6">
          
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-gray-100 pb-2">
              <HelpCircle className="h-4 w-4 text-blue-600" />
              <span>Perguntas Frequentes</span>
            </h3>

            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-gray-800">O que é a Portaria 1510 / 671?</h4>
                <p className="text-[11px] text-gray-500 leading-normal">
                  São as normas do MTE que regulamentam o Registro Eletrônico de Ponto (REP) e o formato doAFD (Arquivo Fonte de Dados) de forma rígida para auditorias.
                </p>
              </div>

              <div className="space-y-1">
                <h4 className="text-xs font-bold text-gray-800">Por que o SRE exige 17 dígitos?</h4>
                <p className="text-[11px] text-gray-500 leading-normal">
                  É o tamanho oficial do número de série física do equipamento gravado no arquivo em cada registro de marcação oficial. Se houver dígitos a menos, insira zeros à esquerda para completar.
                </p>
              </div>

              <div className="space-y-1">
                <h4 className="text-xs font-bold text-gray-800">Como funciona a Régua de Linhas?</h4>
                <p className="text-[11px] text-gray-500 leading-normal">
                  Ela fatiará uma linha AFD fornecida para mostrar as colunas e bytes exatos (tipo de registro, hora, PIS/CPF) segundo as réguas da Portaria 1510, ajudando a debugar erros de preenchimento ou layout corrompido de sistemas.
                </p>
              </div>

              <div className="space-y-1 bg-blue-50/50 p-2.5 rounded border border-blue-100">
                <h4 className="text-xs font-bold text-blue-900">Dica de Exportação</h4>
                <p className="text-[10px] text-blue-700 leading-normal">
                  Sempre use caminhos relativos ao usar o script automatizado Python para que ele rode lindamente no Windows, macOS ou Linux sem a necessidade de reconfigurar caminhos de diretório absolutos.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Technical Checklist */}
          <div className="bg-[#1E293B] text-[#94A3B8] rounded-lg p-5 shadow-sm space-y-3 font-mono text-[11px] border border-gray-800">
            <h4 className="text-[10px] uppercase font-bold text-white tracking-widest border-b border-gray-800 pb-2 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
              <span>Propriedades do AFD SRE</span>
            </h4>
            <div className="space-y-1.5">
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span>Codificação</span>
                <span className="text-white">UTF-8</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span>Quebra de Linha</span>
                <span className="text-white">CRLF / LF</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span>Limite dígitos</span>
                <span className="text-white">17 numéricos</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span>Identificação</span>
                <span className="text-white">Automática</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
