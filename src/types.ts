export interface Clock {
  id: string;
  codigo: string;
  relogio: string;
  fabricacao: string;
  ip: string;
}

export interface GeneratedFile {
  filename: string;
  codigo: string;
  relogioName: string;
  fabricacao: string;
  isUnknown: boolean;
  linesCount: number;
  byteSize: number;
  blocksCount: number;
  content: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export interface ValidationField {
  name: string;
  start: number;
  end: number;
  length: number;
  value: string;
  description: string;
}
