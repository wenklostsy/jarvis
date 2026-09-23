import { Document, Packer, Paragraph, TextRun, HeadingLevel, ExternalHyperlink, Footer, PageNumber } from 'docx'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

export const REPORT_DIR = fileURLToPath(new URL('../reports/', import.meta.url))

export async function writeReport(data, directory = REPORT_DIR) {
  const paragraph = (text, options = {}) => new Paragraph({ text, spacing: { after: 160 }, ...options })
  const title = data.query.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
  const children = [
    paragraph(`Pesquisa sobre ${title}`, { heading: HeadingLevel.TITLE }),
    paragraph(`Preparado pelo JARVIS para Matheus Ribeiro | ${new Date(data.date).toLocaleString('pt-BR')}`),
    paragraph('Documento para validação', { heading: HeadingLevel.HEADING_1 }),
    paragraph('Este relatório reúne informações públicas sobre o assunto solicitado. Revise a síntese e consulte as fontes antes de utilizar as conclusões.'),
    paragraph('Síntese da pesquisa', { heading: HeadingLevel.HEADING_1 }),
    ...data.summary.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/^#{1,6}\s+/gm, '').split(/\n+/).filter(Boolean).map((line) => paragraph(line, /^(?:Conclusão|Evidências|Limitações)[:\s]*$/i.test(line) ? { heading: HeadingLevel.HEADING_2 } : {})),
    paragraph('Método e limitações', { heading: HeadingLevel.HEADING_1 }),
    paragraph(`Consulta realizada por ${data.provider}, com ${data.sources.length} fontes. O conteúdo disponível pode ser parcial, desatualizado ou exigir verificação adicional. ${data.synthesis ? 'A síntese foi gerada automaticamente a partir do conteúdo coletado.' : 'Não foi possível gerar uma síntese; este documento apresenta apenas os resultados coletados.'}`),
    paragraph('Fontes para conferência', { heading: HeadingLevel.HEADING_1 }),
  ]
  data.sources.forEach((source, i) => {
    children.push(paragraph(`[${i + 1}] ${source.title || source.url}`, { keepNext: true }))
    const label = new URL(source.url).hostname + new URL(source.url).pathname
    children.push(new Paragraph({ keepNext: true, children: [new ExternalHyperlink({ link: source.url, children: [new TextRun({ text: label.length > 110 ? `${label.slice(0, 107)}...` : label, style: 'Hyperlink' })] })], spacing: { after: 100 } }))
    children.push(paragraph(source.status))
  })
  const doc = new Document({
    creator: 'JARVIS', title: `Pesquisa sobre ${title}`, description: 'Relatório para revisão de Matheus Ribeiro',
    styles: { default: { document: { run: { font: 'Calibri', size: 24 }, paragraph: { spacing: { line: 288 } } }, title: { run: { color: '000000', size: 38, bold: true } }, heading1: { run: { color: '000000', size: 28, bold: true } } } },
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
      footers: { default: new Footer({ children: [new Paragraph({ children: [new TextRun('JARVIS | Matheus Ribeiro | '), new TextRun({ children: [PageNumber.CURRENT] })] })] }) }, children }],
  })
  await mkdir(directory, { recursive: true })
  const name = `relatorio-${randomUUID()}.docx`
  const path = join(directory, name)
  await writeFile(path, await Packer.toBuffer(doc), { flag: 'wx' })
  return { name, path }
}
