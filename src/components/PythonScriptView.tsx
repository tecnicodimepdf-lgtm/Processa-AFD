import { useState } from "react";
import { Copy, Check, Download, FileCode, Terminal, HelpCircle, Code, ShieldCheck } from "lucide-react";

export default function PythonScriptView() {
  const [activeTab, setActiveTab] = useState<"splitter" | "validator">("splitter");
  const [copied, setCopied] = useState(false);

  const pythonSplitterContent = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SRE - Splitter de Arquivos de Relógio de Ponto (Flat Files)
---------------------------------------------------------
Este script realiza a divisão (split) exata de arquivos consolidados de ponto,
mapeando os blocos (do cabeçalho Tipo 1 ao rodapé Tipo 9) com base no número
de fabricação de 17 dígitos cadastrado no arquivo 'relogios.csv'.

Regras de negócio implementadas:
1. Leitura dinâmica de 'relogios.csv' (separado por vírgula ou ponto e vírgula).
2. Identificação do bloco pelo Número de Fabricação (17 dígitos) contido na linha Tipo 1.
3. Gravação na pasta 'arquivos_gerados/' com nome padrão '{Codigo}{Nome}.txt'.
4. Preservação absoluta do layout (bytes originais, espaços e quebras \\r\\n).
5. Append seguro de múltiplos blocos do mesmo relógio de ponto no mesmo arquivo gerado.
6. Resiliência de encoding com UTF-8 'ignore'.
"""

import os
import re
import csv
import sys
import argparse

def sniffer_csv_delimiter(csv_path):
    """Detecta automaticamente se o separador do CSV é vírgula ou ponto e vírgula."""
    try:
        with open(csv_path, 'r', encoding='utf-8', errors='ignore') as f:
            sample = f.read(4096)
            if not sample:
                return ';'
            # Conta ocorrências dos separadores comuns
            ponto_virgula = sample.count(';')
            virgula = sample.count(',')
            return ';' if ponto_virgula >= virgula else ','
    except Exception:
        return ';'

def carregar_relogios(csv_path):
    """Le o CSV de relógios dinamicamente e mapeia o número de fabricação de 17 dígitos."""
    tabela_relogios = {}
    
    if not os.path.exists(csv_path):
        print(f"\\033[33m[AVISO] Arquivo CSV '{csv_path}' não foi encontrado.\\033[0m")
        print("Mapeamentos automáticos estarão indisponíveis. Usando nomes padrão genéricos.")
        return tabela_relogios

    delimiter = sniffer_csv_delimiter(csv_path)
    print(f"[INFO] Lendo CSV '{csv_path}' com separador '{delimiter}'...")

    try:
        with open(csv_path, 'r', encoding='utf-8', errors='ignore') as f:
            # Normalizar cabeçalho para evitar espaços em branco ou BOM
            reader = csv.reader(f, delimiter=delimiter)
            header = [h.strip().replace('\\ufeff', '').lower() for h in next(reader, [])]
            
            # Identifica os índices das colunas por nome
            # Aceitamos variações de nomes de coluna em português
            idx_codigo = -1
            idx_relogio = -1
            idx_fabricacao = -1
            
            for index, value in enumerate(header):
                if 'codigo' in value or 'código' in value:
                    idx_codigo = index
                elif 'relogio' in value or 'relógio' in value or 'nome' in value:
                    idx_relogio = index
                elif 'fabricacao' in value or 'fabricação' in value or 'número' in value or 'serie' in value:
                    idx_fabricacao = index

            # Fallback caso os nomes não batam perfeitamente
            if idx_codigo == -1: idx_codigo = 0
            if idx_relogio == -1: idx_relogio = 1
            if idx_fabricacao == -1: idx_fabricacao = 2

            total_registros = 0
            for rline in reader:
                if not rline or len(rline) <= max(idx_codigo, idx_relogio, idx_fabricacao):
                    continue
                
                codigo = rline[idx_codigo].strip()
                relogio_nome = rline[idx_relogio].strip()
                n_fabricacao = rline[idx_fabricacao].strip()
                
                # Deixa o número de fabricação limpo (apenas dígitos)
                n_fabricacao_clean = re.sub(r'\\D', '', n_fabricacao)
                
                if len(n_fabricacao_clean) > 0:
                    tabela_relogios[n_fabricacao_clean] = {
                        'codigo': codigo,
                        'relogio': relogio_nome,
                        'fabricacao': n_fabricacao_clean,
                        'ip': rline[3].strip() if len(rline) > 3 else ''
                    }
                    total_registros += 1
            
            print(f"[SUCESSO] {total_registros} relógio(s) importado(s) de '{csv_path}' para o mapeador.")
    except Exception as e:
        print(f"\\033[31m[ERRO] Falha ao processar o CSV: {e}\\033[0m", file=sys.stderr)
        
    return tabela_relogios

def extrair_fabricacao_da_linha_1(linha):
    """Localiza o número de fabricação de 17 dígitos em uma linha do Tipo 1."""
    # Procura um padrão de exatamente 17 dígitos contíguos na linha (resiliente a offsets de layout)
    match = re.search(r'\\b(\\d{17})\\b', linha)
    if match:
        return match.group(1)
    
    # Se não achar entre bordas de palavra, varre qualquer sequência de 17 dígitos consecutivos
    match_fallback = re.search(r'(\\d{17})', linha)
    if match_fallback:
        return match_fallback.group(1)
        
    return None

def processar_split(consolidado_path, relogios_dict, output_folder):
    """Lê o arquivo de forma resiliente, separa os blocos de ponto e salva."""
    if not os.path.exists(consolidado_path):
        print(f"\\033[31m[ERRO] Arquivo consolidado '{consolidado_path}' não foi encontrado.\\033[0m")
        return False

    # Garante diretório de saída
    os.makedirs(output_folder, exist_ok=True)
    
    print(f"[INFO] Carregando arquivo consolidado: '{consolidado_path}'...")
    print(f"[INFO] Processando com preservação absoluta de bytes e encodings (UTF-8, errors='ignore')...")

    blocks_written = {}
    clocks_not_mapped = set()
    current_block_lines = []
    current_fabricacao = None
    
    total_linhas = 0
    total_blocos_processados = 0

    with open(consolidado_path, 'r', encoding='utf-8', errors='ignore') as rf:
        # readlines preserva o caractere de quebra de linha original (\\r\\n ou \\n)
        linhas = rf.readlines()

    for idx, linha in enumerate(linhas):
        total_linhas += 1
        
        # Verifica se o caractere no índice 9 é '1'. NOTA: o índice 9 corresponde ao 10º caractere.
        # Em linhas muito curtas evitamos IndexError checando len(linha) > 9
        caractere_9 = linha[9] if len(linha) > 9 else None
        
        # Se encontrou um cabeçalho de tipo 1
        if caractere_9 == '1':
            # Se já tínhamos um bloco ativo sem rodapéTipo 9, finaliza ele preventivamente ou avisa
            if current_block_lines:
                # Caso ocorra um cabeçalho Tipo 1 sobrepondo antes de um Tipo 9 fechá-lo
                salvar_bloco_coletado(current_block_lines, current_fabricacao, relogios_dict, output_folder, blocks_written)
                total_blocos_processados += 1
                current_block_lines = []
            
            # Informações do novo bloco
            current_fabricacao = extrair_fabricacao_da_linha_1(linha)
            current_block_lines = [linha]
            
            if current_fabricacao:
                # Sanitiza número de fabricação para 17 dígitos
                current_fabricacao = re.sub(r'\\D', '', current_fabricacao)
            else:
                # Tenta extrair qualquer número na linha se não houver de 17 dígitos
                numeros_genericos = re.findall(r'\\d+', linha)
                current_fabricacao = numeros_genericos[0] if numeros_genericos else f"DESCONHECIDO_L{idx+1}"
                
        # Se for linha de batidas Tipo 3 ou qualquer linha intermediária relevante
        elif current_block_lines is not None:
            current_block_lines.append(linha)
            
            # Se a linha atual for o rodapé Tipo 9 (começa com '999999999')
            if linha.startswith('999999999'):
                salvar_bloco_coletado(current_block_lines, current_fabricacao, relogios_dict, output_folder, blocks_written)
                total_blocos_processados += 1
                current_block_lines = []
                current_fabricacao = None

    # Se ao fim do arquivo sobrou um bloco pendente de gravação (ex: sem o rodapé Tipo 9 por corte abrupto)
    if current_block_lines:
        salvar_bloco_coletado(current_block_lines, current_fabricacao, relogios_dict, output_folder, blocks_written)
        total_blocos_processados += 1
        print("\\033[33m[AVISO] Bloco final gravado sem fechar com rodapé clássico Tipo 9.\\033[0m")

    # Resumo final no terminal
    print("\\n" + "="*60)
    print("             RELATÓRIO DE PROCESSAMENTO SRE")
    print("="*60)
    print(f"Total de Linhas Lidas:       {total_linhas}")
    print(f"Total de Blocos Detectados:  {total_blocos_processados}")
    print(f"Arquivos Distintos Gravados: {len(blocks_written)}")
    print("-"*60)
    
    print("Status por arquivo destino:")
    for filepath, count_partes in blocks_written.items():
        fname = os.path.basename(filepath)
        print(f" - {fname:<45} | Blocos unificados: {count_partes}")
    print("="*60 + "\\n")
    return True

def salvar_bloco_coletado(block_lines, fabricacao, relogios_dict, output_folder, blocks_written):
    """Guarda ou anexa (append) o bloco de linhas coletado para o relógio mapeado correspondente."""
    if not fabricacao:
        fabricacao = "SEM_FABRICACAO"
        
    # Busca mapeamento no dicionário de relógios
    relogio_info = relogios_dict.get(fabricacao)
    
    if relogio_info:
        codigo = relogio_info['codigo']
        nome_clean = relogio_info['relogio']
        # Evita caracteres inválidos em caminhos de arquivos
        nome_clean = re.sub(r'[\\\\/*?:"<>|]', '_', nome_clean)
        filename = f"{codigo}{nome_clean}.txt"
    else:
        filename = f"RELOGIO_DESCONHECIDO_{fabricacao}.txt"
        
    filepath = os.path.join(output_folder, filename)
    
    # Gravando em utf-8 com append seguro ('a' mode)
    # Abre preservando estritamente os caracteres de escape invisíveis contidos nas strings
    with open(filepath, 'a', encoding='utf-8', errors='ignore') as wf:
        wf.writelines(block_lines)
        
    # Incrementa contador de blocos neste arquivo
    blocks_written[filepath] = blocks_written.get(filepath, 0) + 1

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='SRE - Splitter de Arquivos Consolidados de Relógio de Ponto.')
    parser.add_argument('-i', '--input', default='consolidado.txt', help='Arquivo consolidado de origem (Ex: consolidado.txt)')
    parser.add_argument('-c', '--csv', default='relogios.csv', help='Caminho do CSV de mapeamento (Ex: relogios.csv)')
    parser.add_argument('-o', '--output', default='arquivos_gerados', help='Pasta onde salvar os arquivos finais')
    
    args = parser.parse_args()
    
    print("+" + "-"*58 + "+")
    print("| Iniciando Splitter SRE de Arquivos de Ponto em Python   |")
    print("+" + "-"*58 + "+")
    
    relogios = carregar_relogios(args.csv)
    sucesso = processar_split(args.input, relogios, args.output)
    
    if sucesso:
        print(f"\\033[32m[SUCESSO] Divisão concluída! Verifique a pasta '{args.output}/'\\033[0m")
    else:
        print(f"\\033[31m[FALHA] Não foi possível completar o processamento.\\033[0m", file=sys.stderr)
`;

  const pythonValidatorContent = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MTE Portarias 1510/671 - Script de Validação e Diagnóstico de Conformidade AFD (QA)
---------------------------------------------------------------------------------
Desenvolvido por Engenharia de Controle de Qualidade (QA) especialista em layouts fixos.
Valida a integridade estrutural, encodings, terminações de linha CR+LF exatas,
sequência lógica de NSR (Número Sequencial de Registro), tamanhos de registros,
e lógica matemática de contadores de rodapé (Tipo 9) contra o físico de arquivos AFD.

Nomenclatura Dinâmica:
Cruza o Número de Fabricação de 17 dígitos no Cabeçalho (Tipo 1, posições 190-206)
com a tabela externa 'relogios.csv' para certificar a correta nomenclatura do split.
"""

import os
import re
import csv
import sys
import argparse

def sniffer_csv_delimiter(csv_path):
    """Detecta automaticamente se o separador do CSV de relógios é vírgula ou ponto e vírgula."""
    try:
        with open(csv_path, 'r', encoding='utf-8', errors='ignore') as f:
            sample = f.read(2048)
            if not sample:
                return ';'
            ponto_virgula = sample.count(';')
            virgula = sample.count(',')
            return ';' if ponto_virgula >= virgula else ','
    except Exception:
        return ';'

def carregar_relogios(csv_path):
    """Lê o arquivo de parametrização relogios.csv e monta o dicionário de mapeamento."""
    tabela_relogios = {}
    if not os.path.exists(csv_path):
        return tabela_relogios

    delimiter = sniffer_csv_delimiter(csv_path)
    try:
        with open(csv_path, 'r', encoding='utf-8', errors='ignore') as f:
            reader = csv.reader(f, delimiter=delimiter)
            header = [h.strip().replace('\\ufeff', '').lower() for h in next(reader, [])]
            
            # Identificação das colunas
            idx_codigo = -1
            idx_relogio = -1
            idx_fabricacao = -1
            
            for index, value in enumerate(header):
                if 'codigo' in value or 'código' in value:
                    idx_codigo = index
                elif 'relogio' in value or 'relógio' in value or 'nome' in value:
                    idx_relogio = index
                elif 'fabricacao' in value or 'fabricação' in value or 'número' in value or 'serie' in value:
                    idx_fabricacao = index

            if idx_codigo == -1: idx_codigo = 0
            if idx_relogio == -1: idx_relogio = 1
            if idx_fabricacao == -1: idx_fabricacao = 2

            for rline in reader:
                if not rline or len(rline) <= max(idx_codigo, idx_relogio, idx_fabricacao):
                    continue
                codigo = rline[idx_codigo].strip()
                relogio_nome = rline[idx_relogio].strip()
                n_fabricacao = rline[idx_fabricacao].strip()
                
                n_fabricacao_clean = re.sub(r'\\D', '', n_fabricacao)
                if n_fabricacao_clean:
                    tabela_relogios[n_fabricacao_clean] = {
                        'codigo': codigo,
                        'relogio': relogio_nome,
                        'fabricacao': n_fabricacao_clean,
                        'ip': rline[3].strip() if len(rline) > 3 else ''
                    }
    except Exception as e:
        print(f"\\033[31m[ERRO] Falha crítica ao ler relogios.csv: {e}\\033[0m", file=sys.stderr)
    return tabela_relogios

def validar_arquivo(filepath, relogios_dict):
    """
    Executa a auditoria completa de QA em um único arquivo AFD.
    Retorna True se aprovado, False caso possua inconformidades regulamentares.
    """
    filename = os.path.basename(filepath)
    print("\\n" + "="*80)
    print(f" AUDITANDO: {filename}")
    print("="*80)

    # 1. Validação de Codificação e Leitura Bruta
    erros = []
    alertas = []
    
    # Tentativa de decodificar como ASCII puro
    try:
        with open(filepath, 'rb') as f:
            bytes_content = f.read()
        bytes_content.decode('ascii')
        print("[OK - ENCODING] Arquivo codificado em ASCII puro de 7 bits.")
    except UnicodeDecodeError:
        # Se falhar em ASCII, tenta ISO-8859-1 que é o padrão regulamentar brasileiro (permitindo acentuações)
        try:
            bytes_content.decode('iso-8859-1')
            print("[INFO - ENCODING] Arquivo possui caracteres acentuados. Codificação ISO-8859-1 (Latin-1) VÁLIDA.")
        except Exception as e:
            erros.append(f"[ERRO - ENCODING] O arquivo contém bytes inválidos e não pode ser lido em ISO-8859-1: {e}")
            print(f"\\033[31m[REPROVADO] Falha crítica de Codificação no arquivo\\033[0m")
            return False

    # Leitura em bytes para validação exata do fim de linha CR+LF (b'\\r\\n')
    with open(filepath, 'rb') as f:
        linhas_bytes = f.readlines()

    if not linhas_bytes:
        erros.append("[ERRO - ESTRUTURA] Arquivo está completamente vazio ou corrompido.")
        print("\\033[31m[REPROVADO] Arquivo sem nenhuma informação.\\033[0m")
        return False

    contadores_fisicos = {
        '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0
    }
    
    cabeçalho_detectado = False
    rodapé_detectado = False
    relogio_serial_interno = None
    expected_dynamic_nsr = 1
    
    for idx_1based, linha_raw in enumerate(linhas_bytes, start=1):
        linha_decoded = linha_raw.decode('iso-8859-1')
        
        # 1. Validando finais de linha exatos CR + LF
        if not linha_raw.endswith(b'\\r\\n'):
            erros.append(f"[ERRO - Linha {idx_1based}] Inconformidade de quebra: Termina em {repr(linha_raw[-2:])} (esperado b'\\\\r\\\\n')")
            
        # Limpar o final de linha para verificar a string e comprimentos fixos de layout
        linha_clean = linha_decoded.replace('\\r', '').replace('\\n', '')
        
        # 2. Verificar se há linhas em branco ou espaçamento órfão
        if not linha_clean or linha_clean.isspace():
            erros.append(f"[ERRO - Linha {idx_1based}] Linha em branco ou espaçamento órfão detectado (violando regra de layout fixo)")
            continue

        # Evitar análise lógica se a linha for muito curta por erro grave
        if len(linha_clean) < 10:
            erros.append(f"[ERRO - Linha {idx_1based}] Registro absurdamente curto ({len(linha_clean)} caracteres). Não passará no validador do governo.")
            continue

        # 3. Tipo do registro (Posição 10, índice 9)
        tipo = linha_clean[9]
        if tipo not in ['1', '2', '3', '4', '5', '6', '7', '9']:
            erros.append(f"[ERRO - Linha {idx_1based}] Tipo de registro inválido no índice 9: '{tipo}' (deve ser 1, 2, 3, 4, 5, 6, 7 ou 9)")
            continue

        # 4. Validando tamanhos fixos oficiais por tipo
        tamanhos_esperados = {
            '1': 302,
            '2': 331,
            '3': 50,
            '4': 73,
            '5': 118,
            '9': 64
        }
        
        if tipo in tamanhos_esperados:
            comprimento_atual = len(linha_clean)
            esperado = tamanhos_esperados[tipo]
            if comprimento_atual != esperado:
                erros.append(f"[ERRO - Linha {idx_1based} - Tipo {tipo}] Tamanho incorreto de registro. Esperado {esperado} caracteres (bytes), obtido {comprimento_atual}")

        # 5. Sequência lógica NSR (Número Sequencial de Registro) - posições 1-9 (fatiamento [0:9])
        nsr_str = linha_clean[0:9]
        if not nsr_str.isdigit():
            erros.append(f"[ERRO - Linha {idx_1based}] NSR inválido. Deve conter apenas dígitos, obtido '{nsr_str}'")
        else:
            nsr_val = int(nsr_str)
            if tipo == '1':
                cabeçalho_detectado = True
                if nsr_str != '000000000':
                    erros.append(f"[ERRO - Linha {idx_1based} - Tipo 1] NSR de Cabeçalho deve ser estritamente '000000000'")
                
                # Extrair o serial interno do Cabeçalho para conferência (Padrão 17 dígitos, posições 190 a 206 -> fatiamento 189:206)
                if len(linha_clean) >= 206:
                    relogio_serial_interno = linha_clean[189:206].strip()
                    relogio_serial_interno = re.sub(r'\\D', '', relogio_serial_interno)
                else:
                    erros.append(f"[ERRO - Linha {idx_1based} - Tipo 1] Cabeçalho curto impossibilitando ler Número de Fabricação")
            
            elif tipo == '9':
                rodapé_detectado = True
                if nsr_str != '999999999':
                    erros.append(f"[ERRO - Linha {idx_1based} - Tipo 9] NSR de Rodapé deve ser estritamente '999999999'")
                
                # 6. Validação do Registro Tipo 9 (Contadores declarados vs Físicos)
                if len(linha_clean) >= 64:
                    try:
                        declarados = {
                            '2': int(linha_clean[10:19]),
                            '3': int(linha_clean[19:28]),
                            '4': int(linha_clean[28:37]),
                            '5': int(linha_clean[37:46]),
                            '6': int(linha_clean[46:55]),
                            '7': int(linha_clean[55:64])
                        }
                        
                        # Confronto com os contadores acumulados
                        for k, fisico_count in contadores_fisicos.items():
                            declarado_count = declarados[k]
                            if fisico_count != declarado_count:
                                erros.append(f"[ERRO - Linha {idx_1based} - Tipo 9] Divergência crítica! Qtd física Tipo {k} é {fisico_count}, mas o Rodapé alega {declarado_count}")
                            else:
                                print(f"[OK - AUDITORIA] Auditoria física do Rodapé Tipo {k} confirmada: {fisico_count} registros.")
                    except ValueError:
                        erros.append(f"[ERRO - Linha {idx_1based} - Tipo 9] Um dos contadores no Rodapé possui caracteres não-numéricos.")
                else:
                    erros.append(f"[ERRO - Linha {idx_1based} - Tipo 9] Rodapé curto ({len(linha_clean)} bytes) impossibilitando cruzar contadores")

            else:
                # É um registro dinâmico (2, 3, 4, 5, 6, 7)
                contadores_fisicos[tipo] += 1
                
                # Validar sequência do NSR: deve iniciar em 1 e incrementar incrementalmente de 1 em 1
                if nsr_val != expected_dynamic_nsr:
                    erros.append(f"[ERRO - Linha {idx_1based} - Tipo {tipo}] NSR quebra a sequência governamental. Esperado {expected_dynamic_nsr:09d}, obtido {nsr_str}")
                    expected_dynamic_nsr = nsr_val + 1
                else:
                    expected_dynamic_nsr += 1

    # 7. Diagnóstico do Cruzamento com relogios.csv e Nome de Arquivo (Requisito Especial do Usuário)
    if not cabeçalho_detectado:
        erros.append("[ERRO - ESTRUTURA] Cabeçalho (Registro Tipo 1) ausente no arquivo.")
    if not rodapé_detectado:
        erros.append("[ERRO - ESTRUTURA] Rodapé/Trailer (Registro Tipo 9) ausente no arquivo.")

    if relogio_serial_interno:
        print(f"[OK - SERIAL] Número de fabricação extraído do Cabeçalho: '{relogio_serial_interno}'")
        
        # Mapeamento do relógio correspondente na lista cadastrada
        relogio_mapped = relogios_dict.get(relogio_serial_interno)
        if relogio_mapped:
            codigo = relogio_mapped['codigo']
            nome_clean = relogio_mapped['relogio']
            nome_clean = re.sub(r'[\\\\/*?:"<>|]', '_', nome_clean)
            nome_esperado = f"{codigo}{nome_clean}.txt"
            
            if filename != nome_esperado:
                alertas.append(f"[ALERTA - NOME] O arquivo '{filename}' está associado ao serial '{relogio_serial_interno}' (Código: {codigo}, Relógio: {nome_clean}). "
                             f"Conforme as regras do splitter, o nome deveria ser '{nome_esperado}'")
            else:
                print(f"[OK - NOMENCLATURA] O nome do arquivo '{filename}' está 100% correto de acordo com o mapeador relogios.csv!")
        else:
            alertas.append(f"[ALERTA - REGISTRO] O Número de fabricação '{relogio_serial_interno}' extraído do Cabeçalho não está no cadastro de 'relogios.csv'")

    # Apresentando resultados da auditoria de QA
    for al in alertas:
        print(f"\\033[33m[ALERT] {al}\\033[0m")

    if erros:
        print(f"\\n\\033[31m[-] DETECTADAS {len(erros)} INCONFORMIDADES DE CONFORMIDADE DE LAYOUT:\\033[0m")
        for err in erros:
            print(f"  \\033[31m{err}\\033[0m")
        print(f"\\n\\033[41m\\033[37m[STATUS: REPROVADO]\\033[0m O arquivo '{filename}' NÃO está apto para importação em sistemas homolorgados pelo MTE.")
        return False
    else:
        print(f"\\n\\033[42m\\033[30m[STATUS: APROVADO]\\033[0m Arquivo '{filename}' respeita strict bytes, integridade, codificação, NSR e contadores! Aprovado para importação regulamentar.")
        return True

def main():
    parser = argparse.ArgumentParser(description='QA AFD compliance - Validador Oficial de Layouts Fixos MTE (Portarias 1510/671).')
    parser.add_argument('-i', '--input', default='arquivos_gerados', help='Caminho para um arquivo AFD individual ou para uma pasta contendo múltiplos arquivos finais.')
    parser.add_argument('-c', '--csv', default='relogios.csv', help='Caminho do CSV de mapeamento relogios.csv.')
    
    args = parser.parse_args()
    
    print("="*80)
    print("   VALIDADOR DE CONFORMIDADE AFD - SISTEMA DE CONTROLE DE QUALIDADE (QA)")
    print("="*80)
    
    relogios = carregar_relogios(args.csv)
    if relogios:
        print(f"[QA DATABASE] Carregados {len(relogios)} relógio(s) parametrizados do cadastro para validação cruzada.")
    else:
        print(f"[QA DATA] Cadastro 'relogios.csv' não encontrado ou sem registros. Sem validação de nomenclatura dinâmica.")

    alvo = args.input
    if os.path.isfile(alvo):
        arquivos = [alvo]
        print(f"[QA SCAN] Localizado 1 arquivo individual para análise de layout.")
    elif os.path.isdir(alvo):
        arquivos = [os.path.join(alvo, f) for f in os.listdir(alvo) if f.lower().endswith('.txt')]
        arquivos.sort()
        print(f"[QA SCAN] Localizado diretório de saída com {len(arquivos)} arquivo(s) texto (.txt) para validação conjunta.")
    else:
        print(f"\\033[31m[ERRO CRÍTICO] O caminho de entrada '{alvo}' não existe ou é inválido.\\033[0m", file=sys.stderr)
        sys.exit(1)

    totais = len(arquivos)
    aprovados = 0
    reprovados = 0
    
    for arq in arquivos:
        sucesso = validar_arquivo(arq, relogios)
        if sucesso:
            aprovados += 1
        else:
            reprovados += 1

    print("\\n" + "="*80)
    print("                      RESUMO CONSOLIDADO VALIDAÇÃO SRE (QA)")
    print("="*80)
    print(f" Total de Arquivos Analisados: {totais}")
    print(f" Total Aprovados para Importação: \\033[32m{aprovados}\\033[0m")
    print(f" Total Reprovados por Falha Layout: \\033[31m{reprovados}\\033[0m")
    
    if reprovados > 0:
        print("\\n\\033[31m[VEREDITO FINAL] AUDITORIA CONCLUÍDA - O lote de arquivos contém falhas regulamentares de layout.\\033[0m")
        sys.exit(1)
    else:
        print("\\n\\033[32m[VEREDITO FINAL] AUDITORIA CONCLUÍDA - Todos os arquivos auditados estão em perfeitas condições normativas!\\033[0m")
        sys.exit(0)

if __name__ == '__main__':
    main()
`;

  const getActiveCode = () => {
    return activeTab === "splitter" ? pythonSplitterContent : pythonValidatorContent;
  };

  const getActiveDownloadName = () => {
    return activeTab === "splitter" ? "split_clocks.py" : "validate_afd.py";
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(getActiveCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadScriptFile = () => {
    const blob = new Blob([getActiveCode()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = getActiveDownloadName();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" id="python-script-view">
      <div className="bg-white border border-gray-200 rounded p-6 shadow-sm">
        {/* Tab Selection */}
        <div className="flex border-b border-gray-150 mb-6 gap-2">
          <button
            onClick={() => {
              setActiveTab("splitter");
              setCopied(false);
            }}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-b-2 transition -mb-[1px] ${
              activeTab === "splitter"
                ? "border-blue-600 text-blue-600 font-extrabold"
                : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
          >
            split_clocks.py (Lógica de Divisão)
          </button>
          <button
            onClick={() => {
              setActiveTab("validator");
              setCopied(false);
            }}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-b-2 transition -mb-[1px] ${
              activeTab === "validator"
                ? "border-blue-600 text-blue-600 font-extrabold"
                : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
          >
            validate_afd.py (Validador QA Oficial)
          </button>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gray-50 border border-gray-150 rounded text-blue-600 shrink-0">
              <FileCode className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-widest">
                {activeTab === "splitter" ? "Script de Automação Python (Splitter)" : "Validador e Auditor MTE (QA)"}
              </h2>
              <p className="text-gray-500 text-xs mt-1.5 leading-relaxed">
                {activeTab === "splitter" 
                  ? "Código pronto para realizar a divisão e unificação de layouts AFD locais." 
                  : "Desenvolvido para auditorias estritas de integridade de layout governo (Portarias 1510/671)."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="btn-copy-script"
              onClick={copyToClipboard}
              className="flex items-center gap-2 px-3.5 py-2 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded text-[10px] font-bold uppercase tracking-wider text-gray-700 transition"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copiar Script</span>
                </>
              )}
            </button>
            <button
              id="btn-download-script"
              onClick={downloadScriptFile}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs uppercase tracking-widest transition shadow-sm"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Baixar {getActiveDownloadName()}</span>
            </button>
          </div>
        </div>

        {/* Guarantees Box */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-150">
          <div className="flex gap-3 text-xs bg-gray-50/50 p-3.5 rounded border border-gray-150">
            <ShieldCheck className="h-4.5 w-4.5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-[#212529] text-[10px] uppercase tracking-wider">
                {activeTab === "splitter" ? "Preservação Absoluta" : "Padrão Governamental"}
              </span>
              <p className="text-gray-450 mt-1 leading-relaxed">
                {activeTab === "splitter" 
                  ? "Garante integridade de bytes, mantendo espaços de preenchimento e pontuação original." 
                  : "Mapeia comprimentos de bytes rígidos de Tipo 1 (302), Tipo 2 (331), Tipo 3 (50)..."}
              </p>
            </div>
          </div>
          <div className="flex gap-3 text-xs bg-gray-50/50 p-3.5 rounded border border-gray-150">
            <Terminal className="h-4.5 w-4.5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-[#212529] text-[10px] uppercase tracking-wider">
                {activeTab === "splitter" ? "Robustez de Encoding" : "Análise Byte-Level"}
              </span>
              <p className="text-gray-450 mt-1 leading-relaxed">
                {activeTab === "splitter" 
                  ? "Suporta arquivos mistos contendo caracteres legados portugueses via utf-8 com ignore." 
                  : "Confere individualmente na camada binária a terminação estrita de quebra CR e LF (\\r\\n)."}
              </p>
            </div>
          </div>
          <div className="flex gap-3 text-xs bg-gray-50/50 p-3.5 rounded border border-gray-150">
            <Code className="h-4.5 w-4.5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-[#212529] text-[10px] uppercase tracking-wider">
                {activeTab === "splitter" ? "Append Sequencial" : "Auditoria Contadores"}
              </span>
              <p className="text-gray-450 mt-1 leading-relaxed">
                {activeTab === "splitter"
                  ? "Se o mesmo equipamento tiver múltiplos blocos distantes, concatena-os corretamente."
                  : "Faz contagem física dinâmica de todos os registros e cruza matematicamente com o Rodapé Tipo 9."}
              </p>
            </div>
          </div>
          <div className="flex gap-3 text-xs bg-gray-50/50 p-3.5 rounded border border-gray-150">
            <HelpCircle className="h-4.5 w-4.5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-[#212529] text-[10px] uppercase tracking-wider">Sem Hardcoding</span>
              <p className="text-gray-450 mt-1 leading-relaxed">
                {activeTab === "splitter"
                  ? "Mapeador lê dinamicamente relogios.csv. Detecta separador vírgula ou ponto-e-vírgula."
                  : "Associa o serial oficial com relogios.csv e certifica a semântica da nomenclatura."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor Terminal Preview */}
        <div className="lg:col-span-2 space-y-3">
          <div className="bg-[#1E1E1E] border border-gray-800 rounded overflow-hidden shadow-md">
            <div className="bg-[#2D2D2D] px-4 py-3 border-b border-gray-850 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 block h-2.5 rounded-full bg-[#FF5F56]"></span>
                <span className="w-2.5 block h-2.5 rounded-full bg-[#FFBD2E]"></span>
                <span className="w-2.5 block h-2.5 rounded-full bg-[#27C93F]"></span>
                <span className="text-[10px] text-gray-400 ml-2 font-mono font-bold uppercase tracking-wider">
                  {getActiveDownloadName()}
                </span>
              </div>
              <span className="text-[10px] text-gray-450 font-mono font-bold uppercase">Python 3.x</span>
            </div>
            <div className="p-4 overflow-x-auto max-h-[500px] text-[11px] font-mono text-[#D4D4D4] leading-relaxed bg-[#1E1E1E]">
              <pre>{getActiveCode()}</pre>
            </div>
          </div>
        </div>

        {/* Local Setup Instructions */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 border-b border-gray-100 pb-2">
              <Terminal className="h-4 w-4 text-blue-600" />
              <span>Como rodar localmente</span>
            </h3>

            <div className="space-y-3 text-xs text-[#212529] leading-relaxed">
              <p className="text-gray-500">
                Este script utiliza apenas bibliotecas nativas do Python (sem necessidade de instalar nenhum pacote via <code className="px-1 py-0.5 bg-gray-100 text-gray-800 rounded font-mono text-[10px] font-semibold">pip install</code>).
              </p>

              <div className="space-y-1">
                <span className="font-bold text-gray-400 text-[10px] uppercase tracking-wider block">Passo 1: Organizar arquivos</span>
                <p className="text-gray-500">
                  {activeTab === "splitter" 
                    ? "Coloque o script, o arquivo consolidado consolidado.txt e a lista de relógios relogios.csv na mesma pasta."
                    : "Coloque o script validador, a pasta arquivos_gerados e o relogios.csv no mesmo diretório de trabalho."}
                </p>
              </div>

              <div className="space-y-1 mt-4">
                <span className="font-bold text-gray-400 text-[10px] uppercase tracking-wider block">Passo 2: Executar no Terminal</span>
                <p className="text-gray-500">
                  Execute no terminal apontando para a pasta ou arquivo desejado:
                </p>
                <div className="p-3 bg-[#1E1E1E] rounded text-[#D4D4D4] font-mono text-[11px] select-all leading-normal border border-gray-800">
                  {activeTab === "splitter" ? "python split_clocks.py" : "python validate_afd.py"}
                </div>
              </div>

              <div className="space-y-1 mt-4">
                <span className="font-bold text-gray-400 text-[10px] uppercase tracking-wider block">Instruções de parâmetros do validador</span>
                <p className="text-gray-500">
                  O validador aceita arquivos individuais ou pastas inteiras de lotes divididos:
                </p>
                <div className="p-3 bg-[#1E1E1E] rounded text-[#D4D4D4] font-mono text-[11px] select-all space-y-1.5 leading-normal border border-gray-800">
                  {activeTab === "splitter" ? (
                    <>
                      <div className="text-gray-500 font-bold"># Exemplo customizado</div>
                      <div className="text-blue-400">python split_clocks.py -i consolidado.txt -c relogios.csv -o saida</div>
                    </>
                  ) : (
                    <>
                      <div className="text-gray-500 font-bold"># Validar pasta inteira de splits</div>
                      <div className="text-blue-400">python validate_afd.py -i arquivos_gerados -c relogios.csv</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded p-5 text-amber-900 text-xs space-y-2">
            <h4 className="font-bold flex items-center gap-1.5 text-amber-800 uppercase tracking-wide text-[10px]">
              <HelpCircle className="h-4 w-4" />
              <span>Diretiva de Qualidade do Especialista</span>
            </h4>
            <p className="leading-relaxed">
              {activeTab === "splitter" 
                ? "Os arquivos originais gerados por relógios de ponto (AFD - Arquivo de Fonte de Dados) possuem comprimentos estipulados pela portaria do MTE. O script preserva estritamente a integridade original de cada byte da extração (inclusive espaços preenchidos pelo relógio no cabeçalho), assegurando que os arquivos finais divididos sejam aceitos por qualquer sistema de tratamento de ponto do mercado (como Dimep, Alterdata, Secullum, Pontomais, etc.) sem disparar erros de CRC ou layout corrompido."
                : "No ecossistema de conformidade do Ministério do Trabalho e Emprego, qualquer alteração sutil nas quebras de linha ou na numeração consecutiva dos registros (NSR) invalida o lote perante fiscais ou sistemas oficiais de auditoria. O script validate_afd.py simula as mesmas rotinas programáticas e matemáticas que os órgãos governamentais utilizam, dando à equipe de SRE e de Backoffice a garantia estrita de aprovação regulamentar prévia de forma automatizada local."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
