# Manual do Usuário: Splitter de Ponto SRE & Mapeamento de Relógios (AFD)

Este documento contém o guia definitivo para estruturação, regras de validação e otimização dos fluxos de processamento de arquivos de registros da Portaria 1510 / 671 MTE utilizando o sistema **Splitter de Ponto SRE**.

---

## 📁 1. Mapeamento de Relógios (Tabela CSV)

Para segmentar um arquivo único consolidado de ponto em múltiplos arquivos por relógio, o sistema necessita de uma tabela de mapeamento que correlacione o **Número de Fabricação** (presente em cada linha de batida no arquivo AFD) com o nome amigável e código do relógio correspondente.

### 📋 Requisitos do Arquivo `relogios.csv`
O arquivo CSV pode ser criado utilizando qualquer editor de planilhas (Microsoft Excel, Google Sheets, LibreOffice Calc) e exportado como formato CSV.

* **Extensão:** `.csv`
* **Codificação:** UTF-8 (Recomendado para evitar distorções de acentos como em `RECEPÇÃO` ou `PORTARIA`).
* **Delimitador Automático:** O sistema detecta seções separadas por ponto e vírgula `;` (padrão brasileiro do Excel) ou vírgula `,` (padrão internacional).

### 🏷️ Estrutura de Colunas Requerida
O importador inteligente busca as seguintes variações de cabeçalho (não diferencia maiúsculas de minúsculas):

1. **Código:** `codigo`, `código` ou primeira coluna.
   * *O que é:* O marcador numérico, IP parcial ou identificador que você quer colocar no início do nome do arquivo gerado.
   * *Exemplo:* `001`, `10A`

2. **Relógio ou Nome:** `relogio`, `relógio`, `nome` ou segunda coluna.
   * *O que é:* O nome físico descritivo da localização do ponto.
   * *Exemplo:* `RECEPCAO PRINCIPAL`, `BIG TRANS - RECANTO`

3. **Número de Fabricação:** `fabricacao`, `fabricação`, `número`, `serie`, `série` ou terceira coluna.
   * *O que é:* O número exato de fabricação do relógio de ponto (composto por **17 dígitos numéricos**). Ele é a chave primária que correlaciona a planilha às linhas do arquivo consolidado.
   * *Exemplo:* `00047005860040681`

4. **IP (Opcional):** `ip` ou quarta coluna.
   * *O que é:* Endereço IP do computador ou equipamento na rede.

---

### 📝 Exemplo de Tabela CSV (`relogios.csv`)

```csv
codigo;relogio;fabricacao;ip
1;BIG TRANS - RECANTO;00047005860040681;192.168.10.20
2;RECEPCAO PRINCIPAL;00047005860045544;192.168.10.21
3;PORTARIA AUXILIAR;00047005860047777;192.168.12.5
```

---

## ⚙️ 2. Processo de Divisão de Arquivos SRE

O motor de divisão trabalha com as seguintes premissas técnicas de preservação legal:

### 🧩 Fluxo de Processamento Line-by-Line
1. **Identificação do Dispositivo:**
   * Cada linha do arquivo AFD (que possui mais de 10 caracteres) possui o número de série gravado no interior do seu layout fixo regulamentado pela Portaria 1510/671 MTE.
   * Para linhas normais de eventos (por exemplo, batidas de ponto tipo 3), o número de fabricação de 17 dígitos é extraído dos índices correspondentes de forma transparente.
2. **Preservação de Registros Especiais:**
   * **Cabeçalho (Tipo 1):** Incluído automaticamente no topo de cada um dos arquivos individuais divididos, garantindo validade de CRC nos sistemas de RH.
   * **Rodapé (Tipo 9):** Repassado fielmente para o encerramento do arquivo individual, assegurando que o arquivo permaneça íntegro para importações.
3. **Fidelidade na Quebra de Linha:**
   * O sistema preserva rigorosamente a formatação do arquivo de origem (tanto quebras `\r\n` de padrão Windows, como `\n` de padrão Linux/macOS).
   * **Soma de Verificação:** Nenhuma informação é reescrita ou modificada de forma perigosa.
4. **Relógios Não Identificados:**
   * Eventos pertencentes a números de série de relógios de ponto não catalogados no seu CSV são agrupados de forma isolada em um arquivo denominado `RELOGIO_DESCONHECIDO_serie.txt` para que você possa rastreá-los facilmente.

---

## 🛠️ 3. Recursos do Painel & Dicas Otimizadas de Uso

O sistema possui quatro ferramentas essenciais projetadas para facilidade de auditoria e automação diária:

### 📥 A. Importador Inteligente Drag-and-Drop
Na aba **"Cadastro Tabela CSV"**, você pode simplesmente arrastar o arquivo `relogios.csv` diretamente para a área tracejada na lateral esquerda. O sistema processará imediatamente o arquivo, atualizará a lista na tela e guardará em cache local os registros.

### 📏 B. Régua de Layout & Validador de Linhas
Localizado na aba **"Régua de Layout"**, este recurso permite inspecionar a formatação de qualquer linha do seu arquivo AFD:
* Cole uma linha suspeita para identificar posições e bytes específicos do AFD.
* O sistema irá parsear automaticamente o tipo de linha (Cabeçalho tipo 1, Marcação de ponto tipo 3, etc.).
* Exibe uma régua numérica para você contar as posições dos caracteres visualmente, excelente para auditoria de importação em sistemas legados do RH.

### 🐍 C. Geração de Script Python Standalone
Disponível na aba **"Código Python"**:
* O sistema gera dinamicamente um script Python pronto para rodar localmente no servidor de arquivos do seu departamento ou agendado no Cron/Tarefa do Windows.
* O script processa diretórios inteiros, detecta delimitadores do CSV localmente, e implementa as mesmas regras robustas de tratamento de quebra de linhas e integridade legal.

### 💡 Dicas Gerais
* **Limpeza de Acumulados:** Se você possui um arquivo AFD consolidador acumulado de meses, faça o processamento no Splitter de Ponto SRE e marque a opção para baixar todos os arquivos em um único pacote `.zip`.
* **Segurança total:** Todo o processamento de arquivos é realizado **100% no seu navegador** de forma privada. Seus dados de CPF, marcações de ponto dos funcionários e tabelas de servidores corporativos nunca sobem para servidores externos.
