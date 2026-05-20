import { useState, useTransition, FormEvent, useRef, DragEvent, ChangeEvent } from "react";
import { Clock } from "../types";
import { Plus, Trash2, Download, Table, RefreshCw, AlertTriangle, FileSpreadsheet, Check, Search, Upload, FileText } from "lucide-react";

interface ClockEditorProps {
  clocks: Clock[];
  setClocks: (clocks: Clock[]) => void;
  loadSampleClocks: () => void;
}

export default function ClockEditor({ clocks, setClocks, loadSampleClocks }: ClockEditorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [newClock, setNewClock] = useState<Omit<Clock, "id">>({
    codigo: "",
    relogio: "",
    fabricacao: "",
    ip: "",
  });
  const [delimiter, setDelimiter] = useState<string>(";");
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [, startTransition] = useTransition();

  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{type: "success" | "error"; message: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      processCSVFile(file);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processCSVFile(file);
    }
  };

  const processCSVFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setUploadStatus({
        type: "error",
        message: "Por favor, envie um arquivo com extensão .csv válida.",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const csvStr = event.target?.result as string;
      parseCSVandLoad(csvStr, file.name);
    };
    reader.onerror = () => {
      setUploadStatus({
        type: "error",
        message: "Erro ao ler o arquivo CSV.",
      });
    };
    reader.readAsText(file, "utf-8");
  };

  const parseCSVandLoad = (csvText: string, filename: string) => {
    try {
      const firstLines = csvText.substring(0, 2048);
      const semicoCount = (firstLines.match(/;/g) || []).length;
      const commaCount = (firstLines.match(/,/g) || []).length;
      const delim = semicoCount >= commaCount ? ";" : ",";

      const lines = csvText.split(/\r?\n/);
      if (lines.length === 0) {
        setUploadStatus({
          type: "error",
          message: "O arquivo CSV parece estar vazio.",
        });
        return;
      }

      const headerLine = lines[0].toLowerCase().replace(/^\uFEFF/i, "");
      const columns = headerLine.split(delim).map(c => c.trim());
      
      let idxCodigo = columns.findIndex(c => c.includes("codigo") || c.includes("código"));
      let idxRelogio = columns.findIndex(c => c.includes("relogio") || c.includes("relógio") || c.includes("nome"));
      let idxFabricacao = columns.findIndex(c => c.includes("fabricacao") || c.includes("fabricação") || c.includes("número") || c.includes("serie") || c.includes("série"));
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
        setUploadStatus({
          type: "success",
          message: `Sucesso! Importados ${importedClocks.length} relógios do arquivo '${filename}'.`,
        });
        setTimeout(() => setUploadStatus(null), 5000);
      } else {
        setUploadStatus({
          type: "error",
          message: "Nenhum relógio válido com número de fabricação encontrado no CSV.",
        });
      }
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setUploadStatus({
        type: "error",
        message: `Falha ao processar o CSV: ${errorMsg}`,
      });
    }
  };

  const handleAddClock = (e: FormEvent) => {
    e.preventDefault();
    if (!newClock.codigo && !newClock.relogio && !newClock.fabricacao) return;

    // Clean manufacturing code to only digits
    const cleanedFabricacao = newClock.fabricacao.replace(/\D/g, "");

    const added: Clock = {
      id: crypto.randomUUID(),
      codigo: newClock.codigo,
      relogio: newClock.relogio,
      fabricacao: cleanedFabricacao,
      ip: newClock.ip || "127.0.0.1",
    };

    setClocks([...clocks, added]);
    setNewClock({ codigo: "", relogio: "", fabricacao: "", ip: "" });
  };

  const handleUpdateClock = (id: string, field: keyof Clock, value: string) => {
    let sanitizedValue = value;
    if (field === "fabricacao") {
      // Allow only digits
      sanitizedValue = value.replace(/\D/g, "");
    }
    setClocks(clocks.map((c) => (c.id === id ? { ...c, [field]: sanitizedValue } : c)));
  };

  const handleDeleteClock = (id: string) => {
    setClocks(clocks.filter((c) => c.id !== id));
  };

  const handleDownloadCSV = () => {
    // Generate CSV string based on selected delimiter
    const header = `Código${delimiter}Relógio${delimiter}Número de Fabricação${delimiter}IP\r\n`;
    const rows = clocks
      .map((c) => `${c.codigo}${delimiter}${c.relogio}${delimiter}${c.fabricacao}${delimiter}${c.ip}`)
      .join("\r\n");

    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "relogios.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2000);
  };

  const filteredClocks = clocks.filter(
    (c) =>
      c.relogio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.fabricacao.includes(searchTerm)
  );

  return (
    <div className="space-y-6" id="clock-editor-view">
      {/* Title card */}
      <div className="bg-white border border-gray-200 rounded p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-blue-600" />
            <span>Mapeamento de Relógios (Tabela CSV)</span>
          </h2>
          <p className="text-gray-500 text-xs mt-1.5 leading-relaxed">
            Cadastre novos relógios de ponto e associe seus respectivos números de fabricação de 17 dígitos para o correto split virtual.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn-load-sample-clocks"
            onClick={loadSampleClocks}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded text-[10px] font-bold uppercase tracking-wider text-gray-700 transition"
          >
            <RefreshCw className="h-3.5 w-3.5 text-gray-500" />
            <span>Usar Dados de Teste</span>
          </button>

          <button
            id="btn-upload-clocks-header"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded text-[10px] font-bold uppercase tracking-wider text-gray-700 transition"
          >
            <Upload className="h-3.5 w-3.5 text-gray-500" />
            <span>Upload CSV</span>
          </button>

          <div className="flex items-center border border-gray-200 rounded overflow-hidden text-[10px] font-bold uppercase tracking-wider bg-gray-50 h-8">
            <span className="px-2 text-gray-450 border-r border-gray-200 select-none">Separador</span>
            <select
              id="select-csv-delimiter"
              value={delimiter}
              onChange={(e) => setDelimiter(e.target.value)}
              className="px-2 py-0.5 font-bold text-gray-700 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value=";">Ponto e Vírgula ( ; )</option>
              <option value=",">Vírgula ( , )</option>
            </select>
          </div>

          <button
            id="btn-download-clocks-csv"
            onClick={handleDownloadCSV}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold uppercase tracking-widest transition shadow-sm"
          >
            {downloadSuccess ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Arquivo Gerado!</span>
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                <span>Exportar relogios.csv</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Grid: Editor list & Manual insertion Form */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Form to insert & Drag-and-Drop Area */}
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-white border border-gray-200 rounded p-5 shadow-sm h-fit">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-1.5 border-b border-gray-100 pb-2">
              <Plus className="h-3.5 w-3.5 text-blue-600" />
              <span>Novo Equipamento</span>
            </h3>
            <form onSubmit={handleAddClock} className="space-y-4">
              <div>
                <label htmlFor="new-clock-code" className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Código (Prefixo / ID)</label>
                <input
                  id="new-clock-code"
                  type="text"
                  value={newClock.codigo}
                  onChange={(e) => setNewClock({ ...newClock, codigo: e.target.value })}
                  placeholder="Ex: 001, 10C"
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded bg-[#F8F9FA] focus:bg-white focus:outline-none transition-colors"
                  required
                />
              </div>
              <div>
                <label htmlFor="new-clock-name" className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Nome do Relógio</label>
                <input
                  id="new-clock-name"
                  type="text"
                  value={newClock.relogio}
                  onChange={(e) => setNewClock({ ...newClock, relogio: e.target.value })}
                  placeholder="Ex: RECEPCAO BR"
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded bg-[#F8F9FA] focus:bg-white focus:outline-none transition-colors"
                  required
                />
              </div>
              <div>
                <label htmlFor="new-clock-fabricacao" className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Número de Fabricação (17 dígitos)
                </label>
                <input
                  id="new-clock-fabricacao"
                  type="text"
                  maxLength={17}
                  value={newClock.fabricacao}
                  onChange={(e) => setNewClock({ ...newClock, fabricacao: e.target.value.replace(/\D/g, "") })}
                  placeholder="Ex: 00047005860040681"
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded font-mono bg-[#F8F9FA] focus:bg-white focus:outline-none transition-colors"
                  required
                />
                {newClock.fabricacao && newClock.fabricacao.length !== 17 && (
                  <span className="text-[10px] text-amber-600 font-medium mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    <span>Possui {newClock.fabricacao.length} dígitos (requer 17)</span>
                  </span>
                )}
              </div>
              <div>
                <label htmlFor="new-clock-ip" className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">IP do Equipamento (Opcional)</label>
                <input
                  id="new-clock-ip"
                  type="text"
                  value={newClock.ip}
                  onChange={(e) => setNewClock({ ...newClock, ip: e.target.value })}
                  placeholder="Ex: 192.168.10.20"
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded bg-[#F8F9FA] focus:bg-white focus:outline-none transition-colors"
                />
              </div>

              <button
                id="btn-add-clock-submit"
                type="submit"
                className="w-full py-2 bg-gray-900 hover:bg-black text-white font-bold rounded text-xs uppercase tracking-widest transition shadow-sm cursor-pointer"
              >
                Adicionar Equipamento
              </button>
            </form>
          </div>

          {/* CSV drag and drop area */}
          <div
            id="csv-drag-drop-zone"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border border-dashed rounded-lg p-5 text-center transition-all duration-200 bg-white ${
              dragActive 
                ? "border-blue-500 bg-blue-50/20 scale-[1.01]" 
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex flex-col items-center">
              <div className={`p-2.5 rounded-full border mb-3 transition-colors ${
                dragActive ? "bg-blue-100 border-blue-200 text-blue-600" : "bg-gray-50 border-gray-100 text-gray-400"
              }`}>
                <Upload className="h-5 w-5" />
              </div>
              <h4 className="text-xs font-bold text-gray-750 uppercase tracking-wider">
                Importar Tabela CSV
              </h4>
              <p className="text-[10px] text-gray-450 mt-1 leading-relaxed max-w-[200px] mx-auto">
                Arraste o arquivo <code className="font-mono bg-gray-50 px-1 py-0.5 rounded text-gray-700 font-semibold">relogios.csv</code> ou clique abaixo para selecionar de sua máquina.
              </p>

              <button
                type="button"
                id="btn-trigger-csv-file-select"
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 px-3 py-1.5 bg-[#F8F9FA] hover:bg-gray-100 border border-gray-250 hover:border-gray-300 text-[10px] text-gray-700 font-bold uppercase tracking-wider rounded transition cursor-pointer"
              >
                Selecionar CSV
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />

              {uploadStatus && (
                <div className={`mt-3 p-2 rounded text-[10px] font-medium leading-relaxed w-full border ${
                  uploadStatus.type === "success" 
                    ? "bg-green-50 text-green-700 border-green-100" 
                    : "bg-red-50 text-red-700 border-red-100"
                }`}>
                  {uploadStatus.message}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SpreadSheet Edit visualizer */}
        <div className="xl:col-span-3 bg-white border border-gray-200 rounded p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Table className="h-4 w-4 text-blue-600" />
                <span>Registros Mapeados ({clocks.length})</span>
              </h3>
              
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                <input
                  id="search-clocks-input"
                  type="text"
                  placeholder="Buscar relógio por nome, série..."
                  value={searchTerm}
                  onChange={(e) => startTransition(() => setSearchTerm(e.target.value))}
                  className="pl-8 pr-3 py-1.5 w-full sm:w-64 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="border border-gray-200 rounded overflow-x-auto">
              <table className="w-full text-left border-collapse" id="table-clocks-spreadsheet">
                <thead>
                  <tr className="bg-gray-50 text-gray-400 font-bold text-[10px] uppercase tracking-wider border-b border-gray-200">
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Nome Friendly do Relógio</th>
                    <th className="py-2.5 px-3">Nº de Fabricação (17 dígitos)</th>
                    <th className="py-2.5 px-3">IP Address</th>
                    <th className="py-2.5 px-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150">
                  {filteredClocks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-400 text-xs font-medium">
                        Nenhum relógio encontrado. Clique em "Usar Dados de Teste" para carregar amostras!
                      </td>
                    </tr>
                  ) : (
                    filteredClocks.map((clock) => {
                      const isUnfitting = clock.fabricacao.length !== 17;
                      return (
                        <tr key={clock.id} className="hover:bg-gray-50/50 text-xs text-[#212529] transition">
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={clock.codigo}
                              onChange={(e) => handleUpdateClock(clock.id, "codigo", e.target.value)}
                              className="w-16 font-semibold border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={clock.relogio}
                              onChange={(e) => handleUpdateClock(clock.id, "relogio", e.target.value)}
                              className="w-full font-medium border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                maxLength={17}
                                value={clock.fabricacao}
                                onChange={(e) => handleUpdateClock(clock.id, "fabricacao", e.target.value)}
                                className={`w-40 font-mono text-xs border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent ${isUnfitting ? "text-amber-600 bg-amber-50" : ""}`}
                              />
                              {isUnfitting && (
                                <span title="Necessita ter exatamente 17 dígitos!" className="cursor-help">
                                  <AlertTriangle className="h-4 w-4 text-amber-500 animate-pulse" />
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={clock.ip}
                              onChange={(e) => handleUpdateClock(clock.id, "ip", e.target.value)}
                              className="w-28 font-mono border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => handleDeleteClock(clock.id)}
                              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition"
                              title="Excluir equipamento"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-4 bg-gray-50 border border-gray-150 rounded text-gray-450 text-[11px] leading-relaxed">
            <span className="font-bold text-gray-750 uppercase tracking-widest block mb-1 text-[10px]">Diretriz de Cruzamento SRE:</span>
            O script em Python e o processador online farão o cruzamento exato do Número de Fabricação extraído do arquivo consolidado (linha tipo 1) com este cadastro. O padrão de nome gerado será <code className="text-[#212529] font-semibold font-mono">{`{Codigo}{Nome_do_Relogio}.txt`}</code>. Exemplo: Código <code className="text-[#212529] font-mono">1</code> + Nome <code className="text-[#212529] font-mono">BIG TRANS</code> cria <code className="text-blue-600 font-mono">1BIG TRANS.txt</code>.
          </div>
        </div>
      </div>
    </div>
  );
}
