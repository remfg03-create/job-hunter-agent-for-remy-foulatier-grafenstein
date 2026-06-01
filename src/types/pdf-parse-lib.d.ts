// The default export of pdf-parse runs debug/test code on require when there is
// no module parent, so we import the lib file directly. @types/pdf-parse only
// types the package root, so declare the deep import here.
declare module "pdf-parse/lib/pdf-parse.js" {
  interface PDFParseResult {
    text: string;
    numpages: number;
    info: unknown;
    metadata: unknown;
    version: string;
  }
  function pdfParse(dataBuffer: Buffer): Promise<PDFParseResult>;
  export default pdfParse;
}
