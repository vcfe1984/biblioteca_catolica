"""Import only the authorized columns. An unsuccessful import never replaces the catalog."""
import csv
import io
import json
import os
import re
import sys
import urllib.request
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
URL = 'https://docs.google.com/spreadsheets/d/178--ZUhnOJwtE44AWgUEdhPyCNNK8IBkf515sb8pIpY/export?format=xlsx&gid=718518414'
FIELDS = {1: 'ubicacion', 3: 'titulo', 4: 'autor', 10: 'editorial', 11: 'lugarPublicacion', 12: 'fecha', 13: 'paginas', 21: 'enlace'}

def read_xlsx(raw):
    ns = {'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    relns = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        matches = [s for s in workbook.findall('s:sheets/s:sheet', ns) if s.get('name', '').strip().casefold() == 'biblioteca']
        if len(matches) != 1:
            raise ValueError('No se encontró una única pestaña BIBLIOTECA. No se importarán otras hojas.')
        sheet = matches[0]
        relations = {r.get('Id'):r.get('Target') for r in ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))}
        path = relations[sheet.get('{'+relns+'}id')]
        path = path.lstrip('/') if path.startswith('/') else 'xl/'+path
        strings = [''.join(si.itertext()) for si in ET.fromstring(archive.read('xl/sharedStrings.xml'))]
        root = ET.fromstring(archive.read(path))
        styles = ET.fromstring(archive.read('xl/styles.xml'))
        formats = {int(f.get('numFmtId')): f.get('formatCode') for f in styles.findall('s:numFmts/s:numFmt',ns)}
        xfs = styles.findall('s:cellXfs/s:xf',ns)
        from pathlib import PurePosixPath
        p = PurePosixPath(path)
        relpath = str(p.parent / '_rels' / (p.name+'.rels'))
        links = {r.get('Id'):r.get('Target') for r in ET.fromstring(archive.read(relpath))} if relpath in archive.namelist() else {}
        hyperlinks = {h.get('ref'):links.get(h.get('{'+relns+'}id'),'') for h in root.findall('s:hyperlinks/s:hyperlink',ns)}
        rows = []
        for row in root.findall('s:sheetData/s:row',ns):
            values = [''] * 22
            for cell in row.findall('s:c',ns):
                ref = cell.get('r'); letters = re.match(r'[A-Z]+',ref).group(); index = 0
                for letter in letters: index = index*26+ord(letter)-64
                index -= 1
                if index not in FIELDS: continue
                value = cell.find('s:v',ns)
                text = value.text if value is not None and value.text else ''
                if cell.get('t') == 's': text = strings[int(text)] if text else ''
                elif cell.get('t') == 'inlineStr': text = ''.join(cell.find('s:is',ns).itertext())
                elif text and cell.get('t') not in ('str','e','b'):
                    fmtid = int(xfs[int(cell.get('s','0'))].get('numFmtId','0'))
                    fmt = formats.get(fmtid,'')
                    if index == 12 and (fmtid in range(14,23) or re.search(r'[dy]',fmt,re.I)):
                        date = datetime(1899,12,30)+timedelta(days=float(text))
                        text = f'{date.day}/{date.month}/{date.year}'
                    elif re.fullmatch(r'-?\d+\.0+',text): text = text.split('.')[0]
                if index == 21 and ref in hyperlinks: text = hyperlinks[ref]
                values[index] = text
            rows.append(values)
        return rows

def convert(raw):
    rows = read_xlsx(raw) if isinstance(raw, bytes) else list(csv.reader(io.StringIO(raw)))
    if not rows or len(rows[0]) < 22 or rows[0][3] != 'Título' or rows[0][21] != 'PDF':
        raise ValueError('La estructura de la hoja ha cambiado; se conserva el catálogo anterior.')
    books = []
    for row in rows[1:]:
        book = {field: (row[col].strip() if col < len(row) else '') for col, field in FIELDS.items()}
        if not any(book.values()):
            continue
        # Only safe, explicit web links can become clickable actions.
        if not re.match(r'^https?://[^\s]+$', book['enlace'], re.I):
            book['enlace'] = ''
        books.append(book)
    if not books:
        raise ValueError('La importación está vacía; se conserva el catálogo anterior.')
    return {'actualizado': datetime.now(timezone.utc).isoformat(), 'libros': books}

if __name__ == '__main__':
    raw = Path(sys.argv[1]).read_bytes() if len(sys.argv) > 1 else urllib.request.urlopen(URL, timeout=60).read()
    catalog = convert(raw)
    target = ROOT / 'data/catalogo.json'
    target.parent.mkdir(exist_ok=True)
    temporary = target.with_suffix('.tmp')
    temporary.write_text(json.dumps(catalog, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    os.replace(temporary, target)
    print(f"Catálogo actualizado: {len(catalog['libros'])} libros, {sum(bool(b['enlace']) for b in catalog['libros'])} enlaces.")
