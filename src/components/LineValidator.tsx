import { useState } from "react";
import { Info, HelpCircle, Code, ListFilter, AlertCircle, FileText } from "lucide-react";

export default function LineValidator() {
  const [testLine, setTestLine] = useState("00000000012025060100047005860040681RECANTO DA BELEZA LTDA");

  const lineLength = testLine.length;
  const index9Char = lineLength > 9 ? testLine[9] : "";
  
  // Predict record type
  let detectedType = "Desconhecido / Em Branco";
  let typeColor = "bg-slate-100 text-slate-600 border-slate-300";
  let description = "Esta linha não pôde ser classificada nos layouts padrão de ponto biométrico.";
  
  if (testLine.startsWith("999999999")) {
    detectedType = "Linha Tipo 9 - Rodapé (Trailer)";
    typeColor = "bg-rose-50 text-rose-700 border-rose-200";
    description = "Indica encerramento de lote/arquivo. Iniciado por exatamente nove noves.";
  } else if (index9Char === "1") {
    detectedType = "Linha Tipo 1 - Cabeçalho (Header)";
    typeColor = "bg-teal-50 text-teal-700 border-teal-200";
    description = "Contém metadados da empresa e do relógio de ponto, incluindo CNPJ e Série de Fabricação.";
  } else if (index9Char === "3") {
    detectedType = "Linha Tipo 3 - Registro de Ponto";
    typeColor = "bg-sky-50 text-sky-700 border-sky-200";
    description = "Representa uma batida de ponto de funcionário, contendo data, hora e PIS.";
  }

  // Find 17 digits
  const has17DigitsMatch = testLine.match(/\d{17}/);
  const manufacturingNumber = has17DigitsMatch ? has17DigitsMatch[0] : null;

  // Make visual ruler
  const characters = testLine.split("");
  
  return (
    <div className="space-y-6" id="line-validator-view">
      <div className="bg-white border border-gray-200 rounded p-6 shadow-sm">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <ListFilter className="h-4 w-4 text-blue-600" />
          <span>Análise Visual de Régua e Layout Fixo (AFD)</span>
        </h2>
        <p className="text-gray-500 text-xs mt-1.5 leading-relaxed">
          Cole uma única linha de registro abaixo para inspecionar seus índices exatos, tamanho de bytes e dados estruturais de forma gráfica.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="test-line-input" className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Insira a linha do arquivo a analisar:</label>
            <input
              id="test-line-input"
              type="text"
              value={testLine}
              onChange={(e) => setTestLine(e.target.value)}
              className="w-full font-mono text-xs px-3 py-2.5 border border-gray-200 rounded bg-[#F8F9FA] focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
              placeholder="Cole aqui a linha..."
            />
          </div>

          {/* Stats pills */}
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="text-[10px] px-2.5 py-1 bg-gray-50 font-bold uppercase tracking-wider rounded text-gray-750 border border-gray-150 select-none">
              Comprimento: <strong className="font-mono text-blue-600">{lineLength}</strong> B
            </span>
            <span className={`text-[10px] px-2.5 py-1 font-bold uppercase tracking-wider rounded border flex items-center gap-1 select-none ${typeColor}`}>
              <FileText className="h-3 w-3" />
              <span>{detectedType}</span>
            </span>
            {index9Char && (
              <span className="text-[10px] px-2.5 py-1 bg-amber-50 rounded text-amber-800 border border-amber-100 font-bold uppercase tracking-wider select-none">
                Índice 9: <strong className="font-mono text-amber-900">'{index9Char}'</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visual ruler dissect */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-gray-100 pb-2">
            <Code className="h-3.5 w-3.5 text-blue-600" />
            <span>Estruturação por Caractere Individual</span>
          </h3>

          <div className="space-y-3">
            <p className="text-xs text-gray-450 leading-relaxed">
              Cada caixa representa um caractere no arquivo. O índice <strong className="text-red-500 font-mono">9</strong> está destacado abaixo como definidor do layout.
            </p>

            {/* Ruler container */}
            <div className="flex flex-wrap gap-1 max-h-[350px] overflow-y-auto p-2.5 bg-gray-50 border border-gray-150 rounded">
              {characters.map((char, index) => {
                const isIndex9 = index === 9;
                let bgClass = "bg-white text-gray-700 border-gray-200 hover:bg-gray-100";
                
                if (isIndex9) {
                  bgClass = "bg-red-500 text-white border-red-600 font-bold animate-pulse";
                } else if (index >= 10 && index <= 26 && index9Char === "1") {
                  bgClass = "bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100";
                } else if (detectedType.includes("Rodapé") && index < 9) {
                  bgClass = "bg-red-50 text-red-700 border-red-100 hover:bg-red-100";
                }

                return (
                  <div
                    key={index}
                    className={`w-7 h-10 flex flex-col justify-between items-center border rounded p-0.5 font-mono select-all transition text-center shrink-0 ${bgClass}`}
                    title={`Caractere: "${char}" | Índice: ${index} (1-based: ${index + 1})`}
                  >
                    <span className="text-[10px] font-bold mt-0.5">{char === " " ? "␣" : char}</span>
                    <span className="text-[8px] text-gray-400 font-mono scale-90">{index}</span>
                  </div>
                );
              })}
              {characters.length === 0 && (
                <div className="w-full py-6 text-center text-gray-400 text-xs font-mono">
                  [ Linha vazia ]
                </div>
              )}
            </div>
            
            <div className="flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-wider text-gray-400 pt-2">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-red-500 block"></span>
                <span>Índice 9 (Classificador)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-blue-100 border border-blue-200 block"></span>
                <span>Posição do Serial (Se Tipo 1)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-white border border-gray-200 block"></span>
                <span>Outros campos</span>
              </div>
            </div>
          </div>
        </div>

        {/* Breakdown Card */}
        <div className="bg-white border border-gray-200 rounded p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-gray-100 pb-2">
            <Info className="h-3.5 w-3.5 text-blue-600" />
            <span>Resultados de Layout</span>
          </h3>

          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded border border-gray-150 space-y-1">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Classificação SRE</span>
              <p className="text-xs font-semibold text-gray-700 leading-normal">{description}</p>
            </div>

            {index9Char === "1" && (
              <div className="p-3 bg-blue-50/50 rounded border border-blue-100 space-y-1">
                <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest block">Localizador de Fabricação</span>
                <div className="flex items-center gap-1.5 justify-between">
                  {manufacturingNumber ? (
                    <>
                      <span className="font-mono text-xs font-bold text-blue-900">{manufacturingNumber}</span>
                      <span className="text-[8px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">17 DÍG</span>
                    </>
                  ) : (
                    <span className="text-xs text-amber-700 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span>Nenhum número de 17 dígitos encontrado nesta linha Tipo 1.</span>
                    </span>
                  )}
                </div>
                {manufacturingNumber && (
                  <p className="text-[10px] text-gray-400 mt-1 leading-normal">
                    Este valor será usado como chave única de busca na tabela CSV de mapeamento.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2 text-xs text-gray-500">
              <span className="font-bold text-gray-400 uppercase tracking-widest text-[10px] block">Regras de Validação SRE:</span>
              <div className="flex gap-2 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
                <p><strong>Cabeçalhos (Tipo 1)</strong>: Devem possuir <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-[10px]">linha[9] == '1'</code>.</p>
              </div>
              <div className="flex gap-2 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
                <p><strong>Batidas (Tipo 3)</strong>: Devem possuir <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-[10px]">linha[9] == '3'</code>.</p>
              </div>
              <div className="flex gap-2 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
                <p><strong>Rodapés (Tipo 9)</strong>: Devem iniciar com <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-[10px]">'999999999'</code>.</p>
              </div>
            </div>

            <div className="bg-amber-50 rounded p-3 border border-amber-100">
              <p className="text-[10px] text-amber-900 leading-normal">
                💡 <strong>Por que o índice 9?</strong> No padrão de arquivos de layout AFD (MTE Portaria 1510 / Portaria 671), as linhas sempre possuem posições fixas de registro. O caractere da décima posição (sequência do arquivo de texto bruto, índice 9 do vetor) designa o Tipo do Registro conforme a regulamentação do Ministério do Trabalho.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
