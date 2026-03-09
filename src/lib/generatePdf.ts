import type { ReportData } from '../components/pdf/DiagnosticReport'

export async function downloadDiagnosticPdf(data: ReportData): Promise<void> {
  // Lazy-load @react-pdf/renderer and the report component to reduce initial bundle
  const [{ pdf }, { createElement }, { default: DiagnosticReport }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('react'),
    import('../components/pdf/DiagnosticReport'),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = createElement(DiagnosticReport, { data }) as any
  const blob = await pdf(doc).toBlob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `diagnostic-${data.company.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
