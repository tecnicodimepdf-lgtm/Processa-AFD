#!/usr/bin/env python3
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
            header = [h.strip().replace('\ufeff', '').lower() for h in next(reader, [])]
            
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
                
                n_fabricacao_clean = re.sub(r'\D', '', n_fabricacao)
                if n_fabricacao_clean:
                    tabela_relogios[n_fabricacao_clean] = {
                        'codigo': codigo,
                        'relogio': relogio_nome,
                        'fabricacao': n_fabricacao_clean,
                        'ip': rline[3].strip() if len(rline) > 3 else ''
                    }
    except Exception as e:
        print(f"\033[31m[ERRO] Falha crítica ao ler relogios.csv: {e}\033[0m", file=sys.stderr)
    return tabela_relogios

def validar_arquivo(filepath, relogios_dict):
    """
    Executa a auditoria completa de QA em um único arquivo AFD.
    Retorna True se aprovado, False caso possua inconformidades regulamentares.
    """
    filename = os.path.basename(filepath)
    print("\n" + "="*80)
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
            print(f"\033[31m[REPROVADO] Falha crítica de Codificação no arquivo\033[0m")
            return False

    # Leitura em bytes para validação exata do fim de linha CR+LF (b'\r\n')
    with open(filepath, 'rb') as f:
        linhas_bytes = f.readlines()

    if not linhas_bytes:
        erros.append("[ERRO - ESTRUTURA] Arquivo está completamente vazio ou corrompido.")
        print("\033[31m[REPROVADO] Arquivo sem nenhuma informação.\033[0m")
        return False

    contadores_fisicos = {
        '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0
    }
    
    ultimo_idx = len(linhas_bytes)
    cabeçalho_detectado = False
    rodapé_detectado = False
    relogio_serial_interno = None
    expected_dynamic_nsr = 1
    
    for idx_1based, linha_raw in enumerate(linhas_bytes, start=1):
        # Década de caracteres / tratamento de quebras
        # Decode usando 'iso-8859-1' para permitir análise lógica de strings
        linha_decoded = linha_raw.decode('iso-8859-1')
        
        # 1. Validando finais de linha exatos CR + LF
        if not linha_raw.endswith(b'\r\n'):
            # Se for a última linha, por vezes arquivos vêm incompletos, mas é falha do mesmo jeito
            erros.append(f"[ERRO - Linha {idx_1based}] Inconformidade de quebra: Termina em {repr(linha_raw[-2:])} (esperado b'\\r\\n')")
            
        # Limpar o final de linha para verificar a string e comprimentos fixos de layout
        linha_clean = linha_decoded.replace('\r', '').replace('\n', '')
        
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
                    relogio_serial_interno = re.sub(r'\D', '', relogio_serial_interno)
                else:
                    erros.append(f"[ERRO - Linha {idx_1based} - Tipo 1] Cabeçalho curto impossibilitando ler Número de Fabricação")
            
            elif tipo == '9':
                rodapé_detectado = True
                if nsr_str != '999999999':
                    erros.append(f"[ERRO - Linha {idx_1based} - Tipo 9] NSR de Rodapé deve ser estritamente '999999999'")
                
                # 6. Validação do Registro Tipo 9 (Contadores declarados vs Físicos)
                # Posições 11 a 64 mapeadas em fatiamento (cada campo de contador tem 9 dígitos)
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
                # Acumular contador dinâmico para comparação posterior no rodapé
                contadores_fisicos[tipo] += 1
                
                # Validar sequência do NSR: deve iniciar em 1 e incrementar incrementalmente de 1 em 1
                if nsr_val != expected_dynamic_nsr:
                    erros.append(f"[ERRO - Linha {idx_1based} - Tipo {tipo}] NSR quebra a sequência governamental. Esperado {expected_dynamic_nsr:09d}, obtido {nsr_str}")
                    # Alinha com o último lido para evitar cascata de falsos erros
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
            # Remove caracteres proibidos em arquivos
            nome_clean = re.sub(r'[\\/*?:"<>|]', '_', nome_clean)
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
        print(f"\\ \033[33m[ALERT]* {al}\033[0m")

    if erros:
        print(f"\n\033[31m[-] DETECTADAS {len(erros)} INCONFORMIDADES DE CONFORMIDADE DE LAYOUT:\033[0m")
        for err in erros:
            print(f"  \033[31m{err}\033[0m")
        print(f"\n\033[41m\033[37m[STATUS: REPROVADO]\033[0m O arquivo '{filename}' NÃO está apto para importação em sistemas homolorgados pelo MTE.")
        return False
    else:
        print(f"\n\033[42m\033[30m[STATUS: APROVADO]\033[0m Arquivo '{filename}' respeita strict bytes, integridade, codificação, NSR e contadores! Aprovado para importação regulamentar.")
        return True

def main():
    parser = argparse.ArgumentParser(description='QA AFD compliance - Validador Oficial de Layouts Fixos MTE (Portarias 1510/671).')
    parser.add_argument('-i', '--input', default='arquivos_gerados', help='Caminho para um arquivo AFD individual ou para uma pasta contendo múltiplos arquivos finais.')
    parser.add_argument('-c', '--csv', default='relogios.csv', help='Caminho do CSV de mapeamento relogios.csv.')
    
    args = parser.parse_args()
    
    print("="*80)
    print("   VALIDADOR DE CONFORMIDADE AFD - SISTEMA DE CONTROLE DE QUALIDADE (QA)")
    print("="*80)
    
    # 1. Carrega relogios parametrizados do CSV
    relogios = carregar_relogios(args.csv)
    if relogios:
        print(f"[QA DATABASE] Carregados {len(relogios)} relógio(s) parametrizados do cadastro para validação cruzada.")
    else:
        print(f"[QA DATA] Cadastro 'relogios.csv' não encontrado ou sem registros. Sem validação de nomenclatura dinâmica.")

    # 2. Identificar se o input é um arquivo único ou um diretório
    alvo = args.input
    if os.path.isfile(alvo):
        arquivos = [alvo]
        print(f"[QA SCAN] Localizado 1 arquivo individual para análise de layout.")
    elif os.path.isdir(alvo):
        # Varre arquivos .txt detro da pasta
        arquivos = [os.path.join(alvo, f) for f in os.listdir(alvo) if f.lower().endswith('.txt')]
        arquivos.sort()
        print(f"[QA SCAN] Localizado diretório de saída com {len(arquivos)} arquivo(s) texto (.txt) para validação conjunta.")
    else:
        print(f"\033[31m[ERRO CRÍTICO] O caminho de entrada '{alvo}' não existe ou é inválido.\033[0m", file=sys.stderr)
        sys.exit(1)

    # 3. Executar o motor de auditoria regulamentar do MTE
    totais = len(arquivos)
    aprovados = 0
    reprovados = 0
    
    for arq in arquivos:
        sucesso = validar_arquivo(arq, relogios)
        if sucesso:
            aprovados += 1
        else:
            reprovados += 1

    print("\n" + "="*80)
    print("                      RESUMO CONSOLIDADO VALIDAÇÃO SRE (QA)")
    print("="*80)
    print(f" Total de Arquivos Analisados: {totais}")
    print(f" Total Aprovados para Importação: \033[32m{aprovados}\033[0m")
    print(f" Total Reprovados por Falha Layout: \033[31m{reprovados}\033[0m")
    
    if reprovados > 0:
        print("\n\033[31m[VEREDITO FINAL] AUDITORIA CONCLUÍDA - O lote de arquivos contém falhas regulamentares de layout.\033[0m")
        sys.exit(1)
    else:
        print("\n\033[32m[VEREDITO FINAL] AUDITORIA CONCLUÍDA - Todos os arquivos auditados estão em perfeitas condições normativas!\033[0m")
        sys.exit(0)

if __name__ == '__main__':
    main()
