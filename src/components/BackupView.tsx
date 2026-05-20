import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { Clock, LogEntry } from "../types";
import { 
  Database, Upload, Download, Trash2, AlertTriangle, Check, RefreshCw, 
  FileDown, FileUp, Info, ShieldAlert, FileText, CheckCircle2, ChevronRight
} from "lucide-react";

interface BackupViewProps {
  clocks: Clock[];
  setClocks: (clocks: Clock[]) => void;
  logs: LogEntry[];
  setLogs: (logs: LogEntry[] | ((prev: LogEntry[]) => LogEntry[])) => void;
  addLog: (type: LogEntry["type"], message: string) => void;
  clearLogs: () => void;
}

export default function BackupView({ clocks, setClocks, logs, setLogs, addLog, clearLogs }: BackupViewProps) {
  const [importMode, setImportMode] = useState<"override" | "merge">("override");
  const [dragActive, setDragActive] = useState(false);
  const [status, setStatus] = useState<{type: "success" | "error"; message: string} | null>(null);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export JSON backup file
  const handleExportBackup = () => {
    try {
      const backupData = {
        clocks,
        logs: logs.slice(-50), // include last 50 logs for reference
        exportedAt: new Date().toISOString(),
        version: "2.4.0",
        app: "Splitter de Ponto SRE"
      };

      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      
      const localeDate = new Date().toISOString().split("T")[0];
      const filename = `sre_backup_splitter_${localeDate}.json`;

      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addLog("success", `Backup de segurança exportado com sucesso: ${filename} (${clocks.length} relógios)`);
      setStatus({
        type: "success",
        message: `Backup '${filename}' gerado e baixado com sucesso!`,
      });
      setTimeout(() => setStatus(null), 5000);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      addLog("error", `Erro ao exportar backup: ${errorMsg}`);
      setStatus({
        type: "error",
        message: `Falha ao gerar o arquivo de backup: ${errorMsg}`,
      });
    }
  };

  // Drag and Drop & File Upload handlers
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processBackupFile(file);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processBackupFile(file);
    }
  };

  const processBackupFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".json")) {
      setStatus({
        type: "error",
        message: "Tipo de arquivo inválido. Por favor, envie um arquivo de backup .json válido.",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonStr = event.target?.result as string;
        const backupObj = JSON.parse(jsonStr);

        if (!backupObj || typeof backupObj !== "object") {
          throw new Error("O arquivo JSON não é válido.");
        }

        // Handle both: wrap-object with { clocks:[] } or raw array of clocks [...]
        let rawClocks: any[] = [];
        let rawLogs: any[] = [];

        if (Array.isArray(backupObj)) {
          rawClocks = backupObj;
        } else {
          if (Array.isArray(backupObj.clocks)) {
            rawClocks = backupObj.clocks;
          } else {
            throw new Error("Elemento 'clocks' ausente ou inválido no arquivo de backup.");
          }
          if (Array.isArray(backupObj.logs)) {
            rawLogs = backupObj.logs;
          }
        }

        const parsedClocks: Clock[] = [];
        for (const item of rawClocks) {
          if (typeof item === "object" && item !== null) {
            parsedClocks.push({
              id: item.id || crypto.randomUUID(),
              codigo: String(item.codigo || ""),
              relogio: String(item.relogio || item.nome || "Não nomeado"),
              fabricacao: String(item.fabricacao || "").replace(/\D/g, ""),
              ip: String(item.ip || "127.0.0.1"),
            });
          }
        }

        if (parsedClocks.length === 0) {
          throw new Error("Nenhum relógio de ponto válido foi localizado dentro deste backup.");
        }

        // Restore clocks based on mode
        if (importMode === "override") {
          setClocks(parsedClocks);
        } else {
          const existingFabricacao = new Set(clocks.map(c => c.fabricacao));
          const newToAdd = parsedClocks.filter(c => !existingFabricacao.has(c.fabricacao));
          if (newToAdd.length > 0) {
            setClocks([...clocks, ...newToAdd]);
          }
        }

        // Restore logs if available in backup
        if (rawLogs.length > 0) {
          const parsedLogs: LogEntry[] = rawLogs.map((l: any) => ({
            id: l.id || crypto.randomUUID(),
            timestamp: l.timestamp || new Date().toLocaleTimeString(),
            type: l.type || "info",
            message: l.message || "",
          }));

          if (importMode === "override") {
            setLogs(parsedLogs);
          } else {
            setLogs((prev) => {
              const existingIds = new Set(prev.map(x => x.id));
              const uniqueNewLogs = parsedLogs.filter(x => !existingIds.has(x.id));
              return [...prev, ...uniqueNewLogs];
            });
          }
        }

        // Create success logs and statuses
        const operationType = importMode === "override" ? "Restauração Completa" : "Restauração Mesclada";
        addLog("success", `${operationType}: ${parsedClocks.length} relógios recuperados com sucesso do backup.`);
        
        setStatus({
          type: "success",
          message: `Sucesso! Base de dados restaurada com ${parsedClocks.length} relógios${rawLogs.length > 0 ? ` e ${rawLogs.length} logs` : ""}.`,
        });

        if (fileInputRef.current) fileInputRef.current.value = "";
        setTimeout(() => setStatus(null), 6000);

      } catch (err: unknown) {
        const errStr = err instanceof Error ? err.message : String(err);
        addLog("error", `Falha na restauração do backup: ${errStr}`);
        setStatus({
          type: "error",
          message: `Estrutura de arquivo inválida: ${errStr}`,
        });
      }
    };

    reader.onerror = () => {
      setStatus({
        type: "error",
        message: "Ocorreu um erro físico de leitura durante a abertura do JSON.",
      });
    };

    reader.readAsText(file, "utf-8");
  };

  const handleClearDatabase = () => {
    setClocks([]);
    clearLogs();
    
    // Clear localStorage values physically to ensure it is wiped clean
    localStorage.removeItem("sre_splitter_clocks");
    localStorage.removeItem("sre_splitter_logs");

    addLog("warning", "A base de dados de relógios e o histórico foram redefinidos e limpos pelo usuário.");
    setStatus({
      type: "success",
      message: "Base de dados e histórico totalmente limpos do navegador!",
    });
    setShowWipeConfirm(false);
    setTimeout(() => setStatus(null), 5000);
  };

  return (
    <div className="space-y-6">
      
      {/* Banner de Boas Vindas */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <Database className="h-4 w-4 text-blue-600" />
            <span>Mecanismo de Backup & Restauro de Segurança</span>
          </h2>
          <p className="text-gray-500 text-xs mt-1.5 leading-relaxed">
            Exporte suas configurações e listas de relógios de ponto mapeadas para arquivos JSON seguros locais e recarregue-as a qualquer momento ou transfira de máquina instantaneamente sem perder logs.
          </p>
        </div>
        
        {/* Quick Database Stats */}
        <div className="bg-[#F8F9FA] rounded border border-gray-150 px-4 py-3 min-w-[180px] text-center font-mono text-[10px] text-gray-500 space-y-1">
          <div className="text-xs font-bold text-gray-700">ESTADO DO BANCO</div>
          <div>Equipamentos: <span className="font-bold text-slate-800">{clocks.length}</span></div>
          <div>Histórico de Logs: <span className="font-bold text-slate-800">{logs.length}</span></div>
        </div>
      </div>

      {/* Grid: Actions Column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: EXPORT BACKUP (Takes 1 Col) */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest pb-2 border-b border-gray-100 flex items-center gap-1.5">
              <FileDown className="h-4 w-4 text-blue-600 animate-bounce" />
              <span>Gerar Backup (Exportar)</span>
            </h3>
            
            <p className="text-xs text-gray-600 leading-relaxed">
              O utilitário empacotará toda a sua lista atual de <strong>{clocks.length} equipamentos mapeados</strong> e os últimos logs de integridade em um arquivo <code className="bg-gray-100 font-mono px-1 rounded text-gray-700">.json</code> estruturado.
            </p>

            <div className="p-3 bg-blue-50/50 rounded border border-blue-100/60 font-mono text-[10px] text-blue-800 leading-normal space-y-1">
              <strong className="font-bold text-blue-900 block flex items-center gap-1">
                <Info className="h-3 w-3" />
                <span>O que o arquivo guarda?</span>
              </strong>
              <span>• Cadastro de Relógios (Código, Nome, Série de 17 dígitos, IPs)</span>
              <br/>
              <span>• Filtros / Delimitador preferido</span>
              <br/>
              <span>• Logs de processamento recentes</span>
            </div>
          </div>

          <div className="pt-6">
            <button
              type="button"
              onClick={handleExportBackup}
              id="btn-trigger-export-backup"
              className="w-full py-2.5 bg-gray-900 hover:bg-black text-white font-bold rounded text-xs uppercase tracking-widest transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <Download className="h-4 w-4" />
              <span>Baixar Backup JSON</span>
            </button>
          </div>
        </div>

        {/* Middle column: IMPORT BACKUP (Takes 2 Cols relative to left column) */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest pb-2 border-b border-gray-100 flex items-center gap-1.5">
            <FileUp className="h-4 w-4 text-blue-600" />
            <span>Recarregar de Backup (Importação)</span>
          </h3>

          <p className="text-xs text-gray-600 leading-relaxed">
            Selecione ou arraste um arquivo de backup em formato <code className="font-mono bg-gray-100 px-1 py-0.5 rounded text-gray-700">.json</code> gerado previamente por este sistema para restaurar.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-[#F8F9FA] p-3 rounded border border-gray-200">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Modo de Restauração:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setImportMode("override")}
                className={`flex-1 sm:flex-none px-3 py-1.5 text-[11px] font-bold rounded transiton ${
                  importMode === "override"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-white hover:bg-gray-100 text-gray-700 border border-gray-200"
                }`}
              >
                Substituir Base Atual
              </button>
              <button
                type="button"
                onClick={() => setImportMode("merge")}
                className={`flex-1 sm:flex-none px-3 py-1.5 text-[11px] font-bold rounded transiton ${
                  importMode === "merge"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-white hover:bg-gray-100 text-gray-700 border border-gray-200"
                }`}
              >
                Mesclar / Somar Itens
              </button>
            </div>
          </div>

          {/* Backup Drag area */}
          <div
            id="backup-drag-zone"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
              dragActive 
                ? "border-blue-500 bg-blue-50/20 scale-[1.01]" 
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex flex-col items-center">
              <div className={`p-2 rounded-full border mb-2 transition-colors ${
                dragActive ? "bg-blue-100 border-blue-200 text-blue-600" : "bg-gray-50 border-gray-100 text-gray-400"
              }`}>
                <Upload className="h-5 w-5" />
              </div>
              <h4 className="text-xs font-bold text-gray-750 uppercase tracking-wider">
                Upload do Arquivo JSON de Backup
              </h4>
              <p className="text-[10px] text-gray-400 mt-1 max-w-sm mx-auto">
                Arraste o arquivo `.json` ou clique para escolher em seu computador.
              </p>

              <button
                type="button"
                id="btn-select-backup-json"
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 px-3 py-1.5 bg-[#F8F9FA] hover:bg-gray-100 border border-gray-250 hover:border-gray-300 text-[10px] text-gray-700 font-bold uppercase tracking-wider rounded transition cursor-pointer"
              >
                Selecionar Arquivo JSON
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />

              {status && (
                <div className={`mt-3 p-2.5 rounded text-[10px] font-medium leading-relaxed w-full border ${
                  status.type === "success" 
                    ? "bg-green-50 text-green-700 border-green-100" 
                    : "bg-red-50 text-red-700 border-red-100"
                }`}>
                  {status.message}
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Danger Zone & Schema */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Schema validation representation */}
        <div className="lg:col-span-2 border border-gray-200 rounded-lg p-5 bg-white space-y-3 shadow-xs">
          <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-blue-500" />
            <span>Especificações de Validação (Desenvolvedor / TI)</span>
          </h4>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Nossos arquivos de salvamento utilizam formato JSON puro. Caso precise alimentar a ferramenta de forma programática utilizando scripts em Powershell/Linux, certifique-se de preencher a estrutura conforme o molde JSON abaixo:
          </p>
          <div className="bg-slate-900 border border-slate-950 text-[#C9D1D9] text-[10px] p-3 rounded font-mono overflow-x-auto select-all leading-normal">
<pre>{`{
  "clocks": [
    {
      "id": "1",
      "codigo": "ID_RELOGIO_01",
      "relogio": "RECEPÇÃO DE PONTO SRE",
      "fabricacao": "00047005860040681",
      "ip": "192.168.10.20"
    }
  ],
  "exportedAt": "2026-05-19T20:53:41Z",
  "version": "2.4.0",
  "app": "Splitter de Ponto SRE"
}`}</pre>
          </div>
        </div>

        {/* Reset Database / Danger Area */}
        <div className="border border-red-200 bg-red-50/30 rounded-lg p-5 flex flex-col justify-between shadow-xs">
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-red-500 uppercase tracking-widest flex items-center gap-1.5 pb-2 border-b border-red-100">
              <ShieldAlert className="h-4 w-4" />
              <span>Zona de Perigo (Reset de Fábrica)</span>
            </h4>
            
            {!showWipeConfirm ? (
              <>
                <p className="text-[11px] text-red-900/80 leading-relaxed">
                  Deseja zerar completamente toda a lista do sistema para realizar uma importação limpa ou teste temporário?
                </p>
                <p className="text-[11px] text-red-700 font-semibold leading-relaxed">
                  O apagamento removerá permanentemente os {clocks.length} relógios biométricos cadastrados de forma irreversível.
                </p>
              </>
            ) : (
              <div className="p-3 bg-red-100 border border-red-200 rounded text-red-900 text-[11px] font-sans space-y-2 animate-in fade-in zoom-in-95 duration-100">
                <span className="font-bold flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                  <span>VOCÊ TEM ABSOLUTA CERTEZA?</span>
                </span>
                <p>Esta ação irá redefinir e limpar todos os relógios (incluindo o armazenamento de retaguarda do localStorage) e esvaziar todos os registros de histórico.</p>
              </div>
            )}
          </div>

          <div className="pt-6">
            {!showWipeConfirm ? (
              <button
                type="button"
                onClick={() => setShowWipeConfirm(true)}
                id="btn-trigger-wipe-confirm-open"
                className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded text-[10px] uppercase tracking-widest transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Limpar Toda a Base</span>
              </button>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2 w-full">
                <button
                  type="button"
                  onClick={handleClearDatabase}
                  id="btn-trigger-wipe-all-db"
                  className="flex-1 py-1.5 bg-red-700 hover:bg-red-800 text-white font-bold rounded text-[10px] uppercase tracking-widest transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Sim, Apagar Tudo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowWipeConfirm(false)}
                  className="flex-1 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded text-[10px] uppercase tracking-widest transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>Cancelar</span>
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
