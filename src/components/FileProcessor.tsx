import { useState, useRef, useTransition, useMemo, ChangeEvent, DragEvent } from "react";
import { Clock, GeneratedFile, LogEntry } from "../types";
import { 
  FileText, Upload, Settings, RefreshCw, Terminal, 
  Layers, CheckCircle, AlertOctagon, Download, Eye, 
  FileCheck, ShieldAlert, Cpu, Trash2, Files
} from "lucide-react";
import JSZip from "jszip";

interface FileProcessorProps {
  clocks: Clock[];
  setClocks: (clocks: Clock[]) => void;
  addLog: (type: LogEntry["type"], message: string) => void;
  logs: LogEntry[];
  clearLogs: () => void;
}

export default function FileProcessor({ clocks, setClocks, addLog, logs, clearLogs }: FileProcessorProps) {
  const [consolidatedText, setConsolidatedText] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
  const [selectedPreview, setSelectedPreview] = useState<GeneratedFile | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const [, startTransition] = useTransition();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Generate beautiful sample data that has multiple blocks to prove append & unknown rules
  const loadSampleFile = () => {
    // Clock 1 - "00047005860040681" (BIG TRANS - RECANTO)
    // Clock 2 - "00047005860045544" (RECEPCAO PRINCIPAL)
    // Unknown Clock - "00047005860049999" (not registered in clocks)
    
    const block1_clock1 = 
      "00000000012025060100047005860040681EMPRESA EXEMPLAR LTDA                             RUA DAS FLORES 123\r\n" +
      "0000000003010620250800111111111111COLABORADOR JOAO SILVA\r\n" +
      "0000000003010620251200111111111111COLABORADOR JOAO SILVA\r\n" +
      "9999999990000000040000000010000000002000000001\r\n";

    const block2_clock2 = 
      "00000000012025060100047005860045544EMPRESA EXEMPLAR LTDA                             RECEPCAO DE ENTRADA\r\n" +
      "0000000003010620250915222222222222COLABORADOR MARIA OLIVEIRA\r\n" +
      "0000000003010620251815222222222222COLABORADOR MARIA OLIVEIRA\r\n" +
      "9999999990000000040000000010000000002000000001\r\n";

    // Same clock again to demonstrate APPEND SAFE!
    const block3_clock1 = 
      "00000000012025060200047005860040681EMPRESA EXEMPLAR LTDA                             RUA DAS FLORES 123\r\n" +
      "0000000003020620250801111111111111COLABORADOR JOAO SILVA\r\n" +
      "0000000003020620251202111111111111COLABORADOR JOAO SILVA\r\n" +
      "9999999990000000040000000010000000002000000001\r\n";

    // Unknown Clock
    const block4_unknown = 
      "00000000012025060100047005860049999FILIAL DO NORTE                                   RODOVIA BR 101 K\r\n" +
      "0000000003010620250830333333333333FUNCIONARIO FABIO LUZ\r\n" +
      "0000000003010620251730333333333333FUNCIONARIO FABIO LUZ\r\n" +
      "9999999990000000040000000010000000002000000001\r\n";

    setConsolidatedText(block1_clock1 + block2_clock2 + block3_clock1 + block4_unknown);
    
    clearLogs();
    addLog("info", "Arquivo consolidado de teste carregado com sucesso!");
    addLog("info", "Contém 4 blocos separados de ponto (2 pertencentes ao relógio '00047005860040681' para testar o Append Seguro).");
    addLog("info", "Contém 1 bloco pertencente ao relógio desconhecido '00047005860049999'.");
  };

  // Safe file reader
  const handleConsolidatedUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setConsolidatedText(text);
      addLog("success", `Arquivo '${file.name}' carregado (${file.size} bytes).`);
    };
    reader.onerror = () => {
      addLog("error", "Falha ao ler o arquivo consolidado.");
    };
    reader.readAsText(file, "utf-8");
  };

  // Drag and drop handlers
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = () => {
    setIsDraggingFile(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setConsolidatedText(text);
      addLog("success", `Arquivo de Arrasto '${file.name}' carregado (${file.size} bytes).`);
    };
    reader.readAsText(file, "utf-8");
  };

  // CSV Drag/Upload Loader
  const handleCSVUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const csvStr = event.target?.result as string;
      parseCSVandLoad(csvStr, file.name);
    };
    reader.readAsText(file, "utf-8");
  };

  const parseCSVandLoad = (csvText: string, filename: string) => {
    try {
      // Sniff delimiter
      const firstLines = csvText.substring(0, 2048);
      const semicoCount = (firstLines.match(/;/g) || []).length;
      const commaCount = (firstLines.match(/,/g) || []).length;
      const delim = semicoCount >= commaCount ? ";" : ",";

      addLog("info", `Detectado separador '${delim}' no CSV de relógios.`);

      const lines = csvText.split(/\r?\n/);
      if (lines.length === 0) {
        addLog("warning", "O arquivo CSV enviado parece estar vazio.");
        return;
      }

      // Normaliza cabeçalho
      const headerLine = lines[0].toLowerCase().replace(/^\uFEFF/i, "");
      const columns = headerLine.split(delim).map(c => c.trim());
      
      let idxCodigo = columns.findIndex(c => c.includes("codigo") || c.includes("código"));
      let idxRelogio = columns.findIndex(c => c.includes("relogio") || c.includes("relógio") || c.includes("nome"));
      let idxFabricacao = columns.findIndex(c => c.includes("fabricacao") || c.includes("fabricação") || c.includes("número") || c.includes("serie"));
      let idxIP = columns.findIndex(c => c.includes("ip"));

      if (idxCodigo === -1) idxCodigo = 0;
      if (idxRelogio === -1) idxRelogio = 1;
      if (idxFabricacao === -1) idxFabricacao = 2;
      if (idxIP === -1) idxIP = 3;

      const importedClocks: Clock[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cells = line.split(delim).map(c => c.trim());
        if (cells.length <= Math.max(idxCodigo, idxRelogio, idxFabricacao)) continue;

        const codigo = cells[idxCodigo] || "";
        const relogio = cells[idxRelogio] || "";
        const rawFabricacao = cells[idxFabricacao] || "";
        const fabricacao = rawFabricacao.replace(/\D/g, "");
        const ip = cells[idxIP] || "127.0.0.1";

        if (fabricacao) {
          importedClocks.push({
            id: crypto.randomUUID(),
            codigo,
            relogio,
            fabricacao,
            ip
          });
        }
      }

      if (importedClocks.length > 0) {
        setClocks(importedClocks);
        addLog("success", `Importados ${importedClocks.length} relógios do arquivo '${filename}'.`);
      } else {
        addLog("warning", "Não foi possível extrair relógios válidos com o padrão de colunas.");
      }
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      addLog("error", `Falha ao processar o arquivo CSV: ${errorMsg}`);
    }
  };

  // CORE PROCESSOR LOGIC (Parallel to the python requirements!)
  const handleProcessSplit = () => {
    if (!consolidatedText.trim()) {
      addLog("error", "Sem dados de entrada. Por favor, cole ou carregue um arquivo.");
      return;
    }

    setIsProcessing(true);
    addLog("info", "Iniciando processo de verificação e agrupamento biométrico...");

    setTimeout(() => {
      try {
        // Prepare dictionary mapping (keyed by 17-digit manufacturing code)
        const clocksMap: Record<string, Clock> = {};
        clocks.forEach(c => {
          if (c.fabricacao) {
            clocksMap[c.fabricacao] = c;
          }
        });

        addLog("info", `Indexados ${Object.keys(clocksMap).length} relógios ativos para busca rápida.`);

        // Split standard flat file contents maintaining their original line feeds!
        // We look for linebreaks without stripping them immediately to preserve byte counts.
        const linesWithEnding: string[] = [];
        let currentPos = 0;
        
        // Loop over consolidated text to keep lines AND their unique endings (\r\n vs \n) intact
        while (currentPos < consolidatedText.length) {
          let nextNewline = consolidatedText.indexOf("\n", currentPos);
          if (nextNewline === -1) {
            linesWithEnding.push(consolidatedText.substring(currentPos));
            break;
          } else {
            linesWithEnding.push(consolidatedText.substring(currentPos, nextNewline + 1));
            currentPos = nextNewline + 1;
          }
        }

        addLog("info", `Total de linhas identificadas no arquivo grande: ${linesWithEnding.length}`);

        // Track parsed files on-the-fly
        // Let's store mapping from filename -> List of block strings
        const filesBlocks: Record<string, {
          codigo: string;
          relogioName: string;
          fabricacao: string;
          isUnknown: boolean;
          blocksList: string[][];
        }> = {};

        let currentBlock: string[] = [];
        let currentFabricacao: string | null = null;
        let blocksCount = 0;

        // Recursive or index block collector
        for (let i = 0; i < linesWithEnding.length; i++) {
          const rawLine = linesWithEnding[i];
          const len = rawLine.length;
          
          // Index 9 verification (10th character)
          // Since \r or \n are at the end, we safeguard layout length check
          const charIndex9 = len > 9 ? rawLine[9] : null;

          if (charIndex9 === "1") {
            // If already collecting, we hit a new block before old closed
            if (currentBlock.length > 0) {
              saveBlock(currentBlock, currentFabricacao, clocksMap, filesBlocks);
              blocksCount++;
              currentBlock = [];
            }

            // Detect manufacturing code
            // Find 17 digits sequentially anywhere in line 1
            const match = rawLine.match(/\d{17}/);
            currentFabricacao = match ? match[0] : null;
            currentBlock = [rawLine];
          } 
          else if (currentBlock.length > 0) {
            currentBlock.push(rawLine);

            // Row 9 checks: begins with 999999999
            if (rawLine.startsWith("999999999")) {
              saveBlock(currentBlock, currentFabricacao, clocksMap, filesBlocks);
              blocksCount++;
              currentBlock = [];
              currentFabricacao = null;
            }
          }
        }

        // Catch tail blocks
        if (currentBlock.length > 0) {
          saveBlock(currentBlock, currentFabricacao, clocksMap, filesBlocks);
          blocksCount++;
          addLog("warning", "O arquivo terminou sem fechamento formal do último bloco Tipo 9.");
        }

        // Build list of GeneratedFiles for view on-screen
        const results: GeneratedFile[] = [];
        
        Object.entries(filesBlocks).forEach(([filename, info]) => {
          // Join blocks sequencially (Append safe!)
          const fullContent = info.blocksList.map(b => b.join("")).join("");
          const totalLineCount = info.blocksList.reduce((sum, b) => sum + b.length, 0);
          
          results.push({
            filename,
            codigo: info.codigo,
            relogioName: info.relogioName,
            fabricacao: info.fabricacao,
            isUnknown: info.isUnknown,
            linesCount: totalLineCount,
            byteSize: new Blob([fullContent]).size, // correct byte representation
            blocksCount: info.blocksList.length,
            content: fullContent
          });

          addLog("success", `Arquivo '${filename}' gerado com ${info.blocksList.length} bloco(s) [${totalLineCount} linhas, ${new Blob([fullContent]).size} bytes].`);
        });

        setGeneratedFiles(results);
        addLog("success", `Processamento concluído. ${results.length} arquivos distintos divididos e prontos para download.`);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        addLog("error", `Falha no processador de layout fixo: ${errorMsg}`);
      } finally {
        setIsProcessing(false);
      }
    }, 400);
  };

  const saveBlock = (
    block: string[],
    fabricacao: string | null,
    clocksMap: Record<string, Clock>,
    filesBlocks: Record<string, {
      codigo: string;
      relogioName: string;
      fabricacao: string;
      isUnknown: boolean;
      blocksList: string[][];
    }>
  ) => {
    const fabKey = fabricacao || "SEM_FABRICACAO";
    const mappedClock = clocksMap[fabKey];

    let filename = "";
    let codigo = "";
    let relogioName = "";
    let isUnknown = false;

    if (mappedClock) {
      codigo = mappedClock.codigo;
      relogioName = mappedClock.relogio;
      // Sanitize name for filenames
      const nameClean = mappedClock.relogio.replace(/[\\/*?:"<>|]/g, "_");
      filename = `${codigo}${nameClean}.txt`;
    } else {
      filename = `RELOGIO_DESCONHECIDO_${fabKey}.txt`;
      codigo = "S/C";
      relogioName = "Não mapeado no CSV";
      isUnknown = true;
    }

    if (!filesBlocks[filename]) {
      filesBlocks[filename] = {
        codigo,
        relogioName,
        fabricacao: fabKey,
        isUnknown,
        blocksList: []
      };
    }

    // Append safe - we append the full list of lines for this block
    filesBlocks[filename].blocksList.push([...block]);
  };

  // Compile JSZip Download
  const handleZipDownload = async () => {
    if (generatedFiles.length === 0) return;

    addLog("info", "Empacotando arquivos digitados na pasta virtual 'arquivos_gerados/'...");
    const zip = new JSZip();

    // Create the required folder structure inside the zip
    const folder = zip.folder("arquivos_gerados");

    generatedFiles.forEach((file) => {
      folder?.file(file.filename, file.content);
    });

    try {
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "arquivos_gerados.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      addLog("success", "Download de arquivos_gerados.zip iniciado com sucesso!");
    } catch {
      addLog("error", "Ocorreu um erro ao empacotar o arquivo ZIP.");
    }
  };

  // Download single file
  const downloadSingleFile = (file: GeneratedFile) => {
    const blob = new Blob([file.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addLog("info", `Efetuado download de ${file.filename}`);
  };

  // Calculate sum of metrics
  const totalProcessedLines = useMemo(() => {
    return generatedFiles.reduce((sum, f) => sum + f.linesCount, 0);
  }, [generatedFiles]);

  const totalBytesProcessed = useMemo(() => {
    return generatedFiles.reduce((sum, f) => sum + f.byteSize, 0);
  }, [generatedFiles]);

  const totalBlocks = useMemo(() => {
    return generatedFiles.reduce((sum, f) => sum + f.blocksCount, 0);
  }, [generatedFiles]);

  return (
    <div className="space-y-6" id="file-processor-view">
      {/* Upper Grid: Uploads and Presets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Loader Upload box */}
        <div className="lg:col-span-2 space-y-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border border-dashed rounded-lg p-6 text-center transition bg-white ${
              isDraggingFile ? "border-blue-500 bg-blue-50/20" : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="max-w-md mx-auto flex flex-col items-center">
              <div className="p-3 bg-gray-50 border border-gray-100 rounded text-gray-450 mb-3 shrink-0">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Upload do Arquivo Consolidado</h3>
              <p className="text-gray-500 text-xs mt-1.5 leading-relaxed">
                Arraste o arquivo em lotes (<code className="font-mono text-[10px] bg-gray-100 px-1 py-0.5 text-gray-700">consolidado.txt</code>) ou selecione de sua máquina de forma direta.
              </p>
              
              <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
                <button
                  id="btn-trigger-file-upload"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 bg-white text-gray-700 font-bold text-[10px] uppercase tracking-wider hover:bg-gray-50 hover:border-gray-300 rounded transition"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Selecionar arquivo</span>
                </button>
                <input
                  id="file-consolidado-real-input"
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  onChange={handleConsolidatedUpload}
                  className="hidden"
                />

                <span className="text-gray-400 text-xs font-medium">ou</span>

                <button
                  id="btn-load-simulation-data"
                  onClick={loadSampleFile}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 active:bg-black text-white font-bold text-[10px] uppercase tracking-wider rounded transition shadow-sm"
                >
                  <RefreshCw className="h-3.5 w-3.5 select-none" />
                  <span>Testar com Arquivo Simulado</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick upload auxiliary for CSv */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-50 rounded text-gray-500 border border-gray-150 shrink-0">
                <Settings className="h-4.5 w-4.5 text-blue-600" />
              </div>
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Enviar arquivo relogios.csv alternativo</span>
                <p className="text-[10px] text-gray-400 mt-0.5">Substitua a sua listagem de relógios registrados a qualquer instante.</p>
              </div>
            </div>
            <div>
              <button
                id="btn-upload-relogios-csv"
                onClick={() => csvInputRef.current?.click()}
                className="px-3 py-2 border border-gray-200 hover:border-gray-300 text-[10px] text-gray-700 font-bold uppercase tracking-wider rounded bg-white hover:bg-gray-50 flex items-center gap-1 transition"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Upload relogios.csv</span>
              </button>
              <input
                id="csv-relogios-real-input"
                ref={csvInputRef}
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                className="hidden"
              />
            </div>
          </div>
        </div>

        {/* Text Area Manual input or Preview */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col justify-between h-[235px]">
          <div className="space-y-2 h-[80%] flex flex-col">
            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Preview dos dados consolidados:</span>
            <textarea
              id="raw-consolidated-input"
              value={consolidatedText}
              onChange={(e) => setConsolidatedText(e.target.value)}
              className="w-full flex-grow p-3 font-mono text-[10px] bg-[#F8F9FA] border border-gray-200 rounded focus:bg-white resize-none focus:outline-none"
              placeholder="Cole aqui o conteúdo consolidado contendo linhas com prefixos de cabeçalho tipo 1 (index 9 = 1) e rodapés..."
            />
          </div>
          <div className="pt-2 flex justify-between items-center text-xs">
            <span className="font-mono text-gray-400">
              {consolidatedText ? `${consolidatedText.length} bytes de texto` : "Sem dados carregados"}
            </span>
            {consolidatedText && (
              <button
                id="btn-clear-main-text"
                onClick={() => setConsolidatedText("")}
                className="text-red-500 font-bold text-[10px] uppercase tracking-wider hover:underline hover:text-red-700 transition"
              >
                Limpar Campo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Button to process */}
      <div className="flex justify-center">
        <button
          id="btn-execute-split-processor"
          onClick={handleProcessSplit}
          disabled={isProcessing || !consolidatedText}
          className={`px-8 py-3 rounded flex items-center gap-2.5 font-bold text-xs uppercase tracking-widest shadow-sm transition-all ${
            consolidatedText && !isProcessing
              ? "bg-blue-600 hover:bg-blue-750 text-white cursor-pointer"
              : "bg-gray-100 text-gray-450 cursor-not-allowed border border-gray-200"
          }`}
        >
          {isProcessing ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />
              <span>Analisando layouts de ponto...</span>
            </>
          ) : (
            <>
              <Cpu className="h-4.5 w-4.5" />
              <span>Processar e Dividir Arquivos</span>
            </>
          )}
        </button>
      </div>

      {/* Retro SRE logs terminal */}
      <div className="bg-[#1E1E1E] rounded border border-gray-800 shadow-md overflow-hidden flex flex-col">
        <div className="bg-[#2D2D2D] border-b border-gray-850 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex gap-1 mr-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F]"></span>
            </div>
            <Terminal className="h-4 w-4 text-blue-400" />
            <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">Terminal SRE — STATUS LOG</span>
          </div>
          <button
            id="btn-clear-terminal-logs"
            onClick={clearLogs}
            className="text-[9px] text-gray-400 hover:text-white font-bold font-mono uppercase tracking-widest bg-[#1E1E1E] border border-gray-800 px-2.5 py-1 rounded transition"
          >
            Limpar Console
          </button>
        </div>
        <div className="p-4 h-[140px] overflow-y-auto space-y-1.5 font-mono text-[11px] text-gray-300 bg-[#1E1E1E]">
          {logs.map((log) => {
            let badgeColor = "text-blue-400";
            if (log.type === "success") badgeColor = "text-emerald-400 font-bold";
            if (log.type === "warning") badgeColor = "text-yellow-500";
            if (log.type === "error") badgeColor = "text-red-400 font-bold";

            return (
              <div key={log.id} className="flex gap-2">
                <span className="text-gray-600 select-none">[{log.timestamp}]</span>
                <span className={`${badgeColor} uppercase tracking-wider shrink-0`}>[{log.type}]</span>
                <span className="text-gray-300 select-all">{log.message}</span>
              </div>
            );
          })}
          {logs.length === 0 && (
            <div className="text-gray-500 italic text-center py-6">
              Console aguardando processamento. Clique em "Processar e Dividir Arquivos" acima.
            </div>
          )}
        </div>
      </div>

      {/* Results Dashboard & Mapped Files Table - Rendered after processing */}
      {generatedFiles.length > 0 && (
        <div className="space-y-6">
          {/* Dashboard metric grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 p-4 rounded shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-gray-50 border border-gray-150 text-blue-600 rounded shrink-0">
                <FileCheck className="h-4.5 w-4.5" />
              </div>
              <div>
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest block">Linhas Totais</span>
                <span className="text-base font-bold font-mono text-gray-800">{totalProcessedLines}</span>
              </div>
            </div>

            <div className="bg-white border border-gray-200 p-4 rounded shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-gray-50 border border-gray-150 text-[#F1F3F5] text-green-750 rounded shrink-0">
                <Layers className="h-4.5 w-4.5 text-blue-600" />
              </div>
              <div>
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest block">Blocos Detectados</span>
                <span className="text-base font-bold font-mono text-gray-800">{totalBlocks}</span>
              </div>
            </div>

            <div className="bg-white border border-gray-200 p-4 rounded shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-gray-50 border border-gray-150 text-blue-650 rounded shrink-0">
                <Files className="h-4.5 w-4.5" />
              </div>
              <div>
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest block">Arquivos Gerados</span>
                <span className="text-base font-bold font-mono text-gray-800">{generatedFiles.length}</span>
              </div>
            </div>

            <div className="bg-white border border-gray-200 p-4 rounded shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-gray-50 border border-gray-150 text-red-500 rounded shrink-0">
                <ShieldAlert className="h-4.5 w-4.5" />
              </div>
              <div>
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest block">Desconhecidos</span>
                <span className="text-base font-bold font-mono text-gray-800">
                  {generatedFiles.filter(f => f.isUnknown).length}
                </span>
              </div>
            </div>
          </div>

          {/* Table displaying generated subfiles */}
          <div className="bg-white border border-gray-200 rounded p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-gray-410 uppercase tracking-widest">Arquivos Criados</h3>
                <p className="text-gray-400 text-xs mt-1">
                  Os blocos AFD foram preservados exatamente e divididos conforme a regra de números de fabricação de relógios.
                </p>
              </div>
              <button
                id="btn-download-all-zip"
                onClick={handleZipDownload}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs uppercase tracking-widest transition shadow-sm"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Salvar Tudo em .ZIP</span>
              </button>
            </div>

            <div className="border border-gray-200 rounded overflow-x-auto">
              <table className="w-full text-left border-collapse" id="table-generated-txt-files">
                <thead>
                  <tr className="bg-gray-50 text-gray-400 font-bold text-[10px] uppercase tracking-wider border-b border-gray-200">
                    <th className="py-3 px-4">Nome do Arquivo Destino</th>
                    <th className="py-3 px-4">Nº de Fabricação</th>
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Status / Presets</th>
                    <th className="py-3 px-4">Registros</th>
                    <th className="py-3 px-4">Tamanho</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150">
                  {generatedFiles.map((file) => (
                    <tr key={file.filename} className="hover:bg-gray-50/50 text-xs text-[#212529] transition">
                      <td className="py-3 px-4 font-mono">
                        <span className="font-semibold block text-gray-900">{file.filename}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-500">
                        {file.fabricacao}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-gray-150 text-gray-700 font-mono rounded font-medium text-[10px]">
                          {file.codigo}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {file.isUnknown ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
                            <AlertOctagon className="h-3 w-3 shrink-0" />
                            <span>DESCONHECIDO</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
                            <CheckCircle className="h-3 w-3 shrink-0" />
                            <span>{file.relogioName}</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-500">
                        {file.linesCount} linhas ({file.blocksCount} b)
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-500">
                        {file.byteSize} B
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        <button
                          id={`btn-preview-file-${file.filename}`}
                          onClick={() => setSelectedPreview(file)}
                          className="px-2.5 py-1 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded text-[10px] font-bold uppercase tracking-wider transition"
                          title="Visualizar Prévia"
                        >
                          <Eye className="h-3 w-3 inline mr-1" />
                          <span>Prévia</span>
                        </button>
                        <button
                          id={`btn-download-single-${file.filename}`}
                          onClick={() => downloadSingleFile(file)}
                          className="px-2.5 py-1 bg-gray-100 hover:bg-gray-250 text-gray-800 rounded font-bold text-[10px] uppercase tracking-wider inline-flex items-center gap-1 transition"
                          title="Baixar Arquivo"
                        >
                          <Download className="h-3 w-3" />
                          <span>TXT</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal displaying code preview */}
      {selectedPreview && (
        <div id="modal-preview-file-dialog" className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-gray-200 rounded-lg shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
            <div className="bg-[#1E1E1E] text-white px-5 py-4 border-b border-gray-850 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-400" />
                <div>
                  <h3 className="font-bold text-xs tracking-widest uppercase text-gray-300">{selectedPreview.filename}</h3>
                  <p className="text-[10px] text-gray-400 mt-0.5 font-mono">
                    Série: {selectedPreview.fabricacao}
                  </p>
                </div>
              </div>
              <button
                id="btn-close-modal-preview"
                onClick={() => setSelectedPreview(null)}
                className="text-gray-400 hover:text-white font-bold text-lg hover:bg-gray-800 px-3 py-1 rounded transition"
              >
                ✕
              </button>
            </div>
            
            <div className="p-4 bg-gray-50 border-b border-gray-200 text-[10px] text-gray-500 uppercase font-bold tracking-wider flex justify-between items-center gap-2">
              <span className="leading-tight">
                🔍 ASSINATURA SRE AFD / BYTE-INTEGRITY SUCCESSFUL
              </span>
              <span className="text-gray-400 font-normal shrink-0">
                {selectedPreview.linesCount} linhas lidas
              </span>
            </div>

            <div className="flex-grow p-4 overflow-y-auto bg-[#1E1E1E] text-gray-300 font-mono text-xs select-all relative min-h-[250px]">
              <pre className="whitespace-pre overflow-x-auto leading-relaxed text-[#D4D4D4]">
                {selectedPreview.content}
              </pre>
            </div>

            <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-200 flex justify-end gap-2 shrink-0">
              <button
                id="btn-download-from-preview"
                onClick={() => {
                  downloadSingleFile(selectedPreview);
                  setSelectedPreview(null);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold uppercase tracking-widest rounded shadow-sm transition"
              >
                Baixar txt
              </button>
              <button
                id="btn-close-preview-footer"
                onClick={() => setSelectedPreview(null)}
                className="px-4 py-2 border hover:bg-gray-150 border-gray-250 text-gray-800 text-[10px] font-bold uppercase tracking-widest rounded transition"
              >
                Fechar Prévia
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
