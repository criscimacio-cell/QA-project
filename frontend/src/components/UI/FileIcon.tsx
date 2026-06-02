interface FileIconProps { mimeType?: string; name?: string; size?: number; }

export default function FileIcon({ mimeType = '', name = '', size = 20 }: FileIconProps) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const mime = mimeType.toLowerCase();

  const getColor = () => {
    if (mime.includes('pdf') || ext === 'pdf') return '#ef4444';
    if (mime.includes('excel') || mime.includes('spreadsheet') || ext === 'xlsx' || ext === 'xls' || ext === 'csv') return '#16a34a';
    if (mime.includes('word') || mime.includes('document') || ext === 'docx' || ext === 'doc') return '#2563eb';
    if (mime.includes('powerpoint') || mime.includes('presentation') || ext === 'pptx' || ext === 'ppt') return '#ea580c';
    if (mime.includes('zip') || mime.includes('compressed') || ext === 'zip') return '#7c3aed';
    if (mime.includes('json') || ext === 'json') return '#d97706';
    if (mime.includes('xml') || ext === 'xml') return '#0891b2';
    if (mime.includes('image') || ext === 'png' || ext === 'jpg' || ext === 'jpeg') return '#ec4899';
    if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx') return '#0ea5e9';
    return '#6b7280';
  };

  const getLabel = () => {
    if (mime.includes('pdf') || ext === 'pdf') return 'PDF';
    if (ext === 'xlsx' || ext === 'xls') return 'XLS';
    if (ext === 'csv') return 'CSV';
    if (ext === 'docx' || ext === 'doc') return 'DOC';
    if (ext === 'pptx' || ext === 'ppt') return 'PPT';
    if (ext === 'zip') return 'ZIP';
    if (ext === 'json') return 'JSON';
    if (ext === 'xml') return 'XML';
    if (mime.includes('image')) return 'IMG';
    if (ext === 'ts' || ext === 'tsx') return 'TS';
    return ext.toUpperCase().slice(0, 4) || 'FILE';
  };

  const color = getColor();
  const label = getLabel();
  const s = size;

  return (
    <svg width={s} height={s * 1.25} viewBox="0 0 20 25" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 0h11l6 6v19H3V0z" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1.5"/>
      <path d="M14 0l6 6h-6V0z" fill={color} fillOpacity="0.3"/>
      <text x="10" y="17" textAnchor="middle" fontSize="5.5" fontWeight="700" fill={color} fontFamily="sans-serif">{label}</text>
    </svg>
  );
}
