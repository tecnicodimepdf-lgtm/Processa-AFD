import { useState, useTransition, useEffect } from "react";
import { Clock, LogEntry } from "./types";
import FileProcessor from "./components/FileProcessor";
import ClockEditor from "./components/ClockEditor";
import LineValidator from "./components/LineValidator";
import PythonScriptView from "./components/PythonScriptView";
import UserGuideView from "./components/UserGuideView";
import BackupView from "./components/BackupView";
import { 
  Database, Cpu, Terminal, FileCode, CheckSquare, 
  HelpCircle, ChevronRight, Activity, BookOpen, AlertCircle, Save
} from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<"processor" | "clocks" | "ruler" | "script" | "manual" | "backup">("processor");
  const [, startTransition] = useTransition();

  // Initial mockup clocks records with localStorage persistence
  const [clocks, setClocks] = useState<Clock[]>(() => {
    const saved = localStorage.getItem("sre_splitter_clocks");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error("Failed to parse saved clocks", e);
      }
    }
    return [
      {
        id: "1",
        codigo: "1",
        relogio: "BIG TRANS - RECANTO",
        fabricacao: "00047005860040681",
        ip: "192.168.10.20",
      },
      {
        id: "2",
        codigo: "2",
        relogio: "RECEPCAO PRINCIPAL",
        fabricacao: "00047005860045544",
        ip: "192.168.10.21",
      },
    ];
  });

  // Automatically save clocks on state changes
  useEffect(() => {
    localStorage.setItem("sre_splitter_clocks", JSON.stringify(clocks));
  }, [clocks]);

  const [logs, setLogs] = useState<LogEntry[]>(() => {
    const saved = localStorage.getItem("sre_splitter_logs");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error("Failed to parse saved logs", e);
      }
    }
    return [
      {
        id: "init",
        timestamp: new Date().toLocaleTimeString(),
        type: "info",
        message: "Processador de arquivos de layout fixo SRE iniciado e pronto para uso.",
      },
      {
        id: "init-db",
        timestamp: new Date().toLocaleTimeString(),
        type: "info",
        message: "Pre-carregados 2 presets de relógio de ponto no cadastro virtual.",
      }
    ];
  });

  // Automatically save logs on state changes
  useEffect(() => {
    localStorage.setItem("sre_splitter_logs", JSON.stringify(logs));
  }, [logs]);

  const addLog = (type: LogEntry["type"], message: string) => {
    setLogs((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString(),
        type,
        message,
      },
    ]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const loadSampleClocks = () => {
    const sample: Clock[] = [
      {
        id: "s1",
        codigo: "1",
        relogio: "BIG TRANS - RECANTO",
        fabricacao: "00047005860040681",
        ip: "192.168.1.10",
      },
      {
        id: "s2",
        codigo: "2",
        relogio: "RECEPCAO PRINCIPAL",
        fabricacao: "00047005860045544",
        ip: "192.168.1.11",
      },
      {
        id: "s3",
        codigo: "3",
        relogio: "PORTARIA AUXILIAR",
        fabricacao: "00047005860047777",
        ip: "192.168.12.5",
      }
    ];
    setClocks(sample);
    addLog("success", "Carregada tabela modelo de relógios com 3 conexões ativas.");
  };

  return (
    <div className="bg-[#F8F9FA] min-h-screen text-[#212529] flex flex-col font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      
      {/* Top Banner indicating Portarias of Ponto in Brazil */}
      <div className="bg-[#2D2D2D] text-[#CCCCCC] text-[10px] py-1.5 px-8 flex justify-between items-center border-b border-gray-850 shrink-0 select-none">
        <div className="flex items-center gap-2 font-mono">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Ambiente Virtual SRE • Portarias 1510 / 671 MTE</span>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-[10px] font-mono tracking-wider">
          <span>Encoding: UTF-8</span>
          <span>|</span>
          <span>Byte-integrity validated</span>
        </div>
      </div>

      {/* Main Beautiful Header Navigation */}
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0 shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white shrink-0">
            <Cpu className="h-4.5 w-4.5" />
          </div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-[17px] font-bold tracking-tight text-gray-800">Splitter de Ponto SRE</h1>
            <span className="text-gray-400 font-normal text-xs font-mono">v2.4.0</span>
          </div>
        </div>

        {/* Live System Specs indicator */}
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-6 text-xs text-gray-500 font-mono uppercase tracking-widest">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>{clocks.length} Relógios Ativos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>SRE ONLINE</span>
            </div>
          </div>
          <div className="px-3 py-1 bg-green-50 text-green-700 text-[10px] font-bold rounded-full border border-green-100 select-none tracking-wider uppercase">
            SYSTEM READY
          </div>
        </div>
      </header>

      {/* Dynamic Navigation Sub-header Bar */}
      <div className="bg-white border-b border-gray-200 py-2 px-8">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-1">
          <button
            id="tab-btn-processor"
            onClick={() => startTransition(() => setActiveTab("processor"))}
            className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition ${
              activeTab === "processor"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            <span>Processador de Divisão</span>
          </button>

          <button
            id="tab-btn-clocks"
            onClick={() => startTransition(() => setActiveTab("clocks"))}
            className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition ${
              activeTab === "clocks"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            <span>Cadastro Tabela CSV ({clocks.length})</span>
          </button>

          <button
            id="tab-btn-ruler"
            onClick={() => startTransition(() => setActiveTab("ruler"))}
            className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition ${
              activeTab === "ruler"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>Régua de Layout</span>
          </button>

          <button
            id="tab-btn-script"
            onClick={() => startTransition(() => setActiveTab("script"))}
            className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition ${
              activeTab === "script"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <FileCode className="h-3.5 w-3.5" />
            <span>Código Python</span>
          </button>

          <button
            id="tab-btn-manual"
            onClick={() => startTransition(() => setActiveTab("manual"))}
            className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition ${
              activeTab === "manual"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Manual do Usuário</span>
          </button>

          <button
            id="tab-btn-backup"
            onClick={() => startTransition(() => setActiveTab("backup"))}
            className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition ${
              activeTab === "backup"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Save className="h-3.5 w-3.5" />
            <span>Backup e Segurança</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Screen Segment */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 md:p-6 pb-20 space-y-6">
        
        {/* Banner with warning and instruction */}
        {activeTab === "processor" && clocks.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-amber-900 text-xs animate-in slide-in-from-top duration-300">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-800">Seu cadastro interno de relógios está vazio!</span>
              <p className="mt-0.5">
                Clique na aba <strong>"Cadastro Tabela CSV"</strong> acima para registrar seus equipamentos ou clique em "Usar Dados de Teste". Sem o mapeamento por Número de Fabricação, todas as divisões do arquivo consolidado serão salvas como <code className="bg-amber-100 font-mono text-[10px] px-1 rounded">RELOGIO_DESCONHECIDO_serie.txt</code> conforme estipulado.
              </p>
            </div>
          </div>
        )}

        {/* Tab content switching */}
        <div>
          {activeTab === "processor" && (
            <div className="animate-in fade-in duration-150">
              <FileProcessor 
                clocks={clocks} 
                setClocks={setClocks} 
                addLog={addLog} 
                logs={logs} 
                clearLogs={clearLogs} 
              />
            </div>
          )}

          {activeTab === "clocks" && (
            <div className="animate-in fade-in duration-150">
              <ClockEditor 
                clocks={clocks} 
                setClocks={setClocks} 
                loadSampleClocks={loadSampleClocks} 
              />
            </div>
          )}

          {activeTab === "ruler" && (
            <div className="animate-in fade-in duration-150">
              <LineValidator />
            </div>
          )}

          {activeTab === "script" && (
            <div className="animate-in fade-in duration-150">
              <PythonScriptView />
            </div>
          )}

          {activeTab === "manual" && (
            <div className="animate-in fade-in duration-150">
              <UserGuideView />
            </div>
          )}

          {activeTab === "backup" && (
            <div className="animate-in fade-in duration-150">
              <BackupView 
                clocks={clocks} 
                setClocks={setClocks} 
                logs={logs} 
                setLogs={setLogs}
                addLog={addLog} 
                clearLogs={clearLogs} 
              />
            </div>
          )}
        </div>

        {/* Guidelines section on footer/side of dashboard */}
        <div className="border border-gray-200 rounded-lg p-6 bg-white space-y-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-800">
            <BookOpen className="h-4 w-4 text-blue-600" />
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Entenda o Processamento de Blocos e Quebras de Linha</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-gray-600 leading-relaxed">
            <div className="space-y-1.5 p-4 bg-[#F8F9FA] border border-gray-150 rounded">
              <div className="flex items-center gap-1.5 font-bold text-gray-900">
                <span className="bg-blue-100 text-blue-700 w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono">01</span>
                <span>Varredura Dinâmica</span>
              </div>
              <p>
                O motor lerá dinamicamente o arquivo <code className="font-mono text-[10px] bg-gray-100 text-gray-800 rounded px-1">relogios.csv</code>, eliminando qualquer necessidade de engessar IPs ou números de série de relógios de ponto no interior do código.
              </p>
            </div>

            <div className="space-y-1.5 p-4 bg-[#F8F9FA] border border-gray-150 rounded">
              <div className="flex items-center gap-1.5 font-bold text-gray-900">
                <span className="bg-blue-100 text-blue-700 w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono">02</span>
                <span>Fidelidade de Transmissão</span>
              </div>
              <p>
                A integridade do arquivo é assegurada pela leitura de strings intocadas. Não ocorre recriação ou novo cálculo do registro ou rodapé Tipo 9. Cada caractere invisível como <code className="font-mono text-[10px] bg-gray-100 text-gray-800 rounded px-1">\r\n</code> é transferido exatamente da origem.
              </p>
            </div>

            <div className="space-y-1.5 p-4 bg-[#F8F9FA] border border-gray-150 rounded">
              <div className="flex items-center gap-1.5 font-bold text-gray-900">
                <span className="bg-blue-100 text-blue-700 w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono">03</span>
                <span>Consolidação Linear</span>
              </div>
              <p>
                Caso o consolidado possua subblocos espalhados ao longo do tempo para o mesmo relógio biométrico, o processador fará um "Append SEGURO" anexando as informações na sequência lida, garantindo que o cabeçalho original permaneça íntegro.
              </p>
            </div>
          </div>
        </div>

      </main>

      {/* Footer detailing developer expert credentials */}
      <footer className="bg-white text-gray-500 text-xs py-10 px-8 mt-auto border-t border-gray-200">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="font-bold text-gray-800 block text-sm">Splitter de Relógios SRE - Arquivos AFD</span>
            <p className="text-gray-400">Desenvolvido sob rígidos padrões de preservação digital e tratamento transparente de bytes.</p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-gray-400 font-mono text-[11px]">
            <span className="hover:text-blue-600 transition cursor-help flex items-center gap-1">
              <ChevronRight className="h-3 w-3 text-blue-500" />
              <span>Portaria 1510/2009 MTE</span>
            </span>
            <span className="hover:text-blue-600 transition cursor-help flex items-center gap-1">
              <ChevronRight className="h-3 w-3 text-blue-500" />
              <span>Portaria 671/2021 MTE</span>
            </span>
            <span className="hover:text-blue-600 transition cursor-help flex items-center gap-1">
              <ChevronRight className="h-3 w-3 text-blue-500" />
              <span>SRE Integridade de Arquivos</span>
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}
