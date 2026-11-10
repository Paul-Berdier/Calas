import type {RichDocument} from '../../lib/cms/types';

export interface PdfImportProgress {message:string; percent?:number}
export interface PdfImportOptions {
  onProgress?:(progress:PdfImportProgress)=>void;
  signal?:AbortSignal;
  /** Explicit retry: OCR every page, including pages with native text or only
   * vectors. Default detection only OCRs bitmap pages with little usable text. */
  forceOcr?:boolean;
}
export interface PdfImportResult {
  title:string;
  excerpt:string;
  body:RichDocument;
  pageCount:number;
  ocrPages:number;
  warnings:string[];
}
export interface ExtractedParagraph {text:string; style:'normal'|'h2'}
export interface PdfTextItem {
  str:string; transform:unknown[]; width:number; height:number; hasEOL?:boolean; dir?:string;
}
export interface OcrAssetPaths {workerPath:string; corePath:string; langPath:string}
export type OcrRequest = {type:'init'; paths:OcrAssetPaths}|{type:'recognize'; image:Blob}|{type:'cancel'};
export type OcrResponse = {type:'ready'}|{type:'progress'; progress:number; status:string}|{type:'result'; text:string; confidence:number}|{type:'error'; message:string}|{type:'cancelled'};

export const PDF_IMPORT_LIMITS={bytes:20*1024*1024,pages:40,characters:200_000,canvasSide:2000,dpi:150} as const;
export class PdfImportError extends Error {
  constructor(message:string){super(message);this.name='PdfImportError';}
}
