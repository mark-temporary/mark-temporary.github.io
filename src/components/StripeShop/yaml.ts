/**
 * Minimal YAML parser shared by Shop and ProductDetail.
 * Same recursive-descent approach as the Showcase parser.
 */

export type YamlValue = string | YamlValue[] | YamlMap;
export type YamlMap   = Record<string, YamlValue>;

export function parseYaml(raw: string): YamlMap {
  const lines  = raw.replace(/\r\n/g, '\n').split('\n');
  let   cursor = 0;
  const indentOf  = (l: string) => l.match(/^(\s*)/)?.[1].length ?? 0;
  const isBlank   = (l: string) => /^\s*(#.*)?$/.test(l);
  const stripCmt  = (s: string) => s.replace(/(\s|^)#.*$/, '').trim();
  const unquote   = (s: string) => {
    const t = s.trim();
    return ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))
      ? t.slice(1, -1) : t;
  };
  const inlineSeq = (s: string): string[] => {
    const inner = s.slice(s.indexOf('[') + 1, s.lastIndexOf(']'));
    return inner ? inner.split(',').map(x => unquote(stripCmt(x))).filter(Boolean) : [];
  };
  const blockScalar = (fold: boolean, ownerIndent: number): string => {
    const buf: string[] = [];
    while (cursor < lines.length) {
      const ln = lines[cursor];
      if (!isBlank(ln) && indentOf(ln) <= ownerIndent) break;
      buf.push(ln.replace(/^\s{0,2}/, ''));
      cursor++;
    }
    while (buf.length && buf[buf.length - 1].trim() === '') buf.pop();
    return fold ? buf.join(' ').replace(/\s{2,}/g, ' ').trim() : buf.join('\n').trim();
  };
  function mapping(baseIndent: number): YamlMap {
    const map: YamlMap = {};
    while (cursor < lines.length) {
      const line = lines[cursor];
      if (isBlank(line)) { cursor++; continue; }
      if (indentOf(line) <= baseIndent) break;
      const km = line.match(/^(\s*)([A-Za-z_][A-Za-z0-9_]*):\s*(.*)/);
      if (!km) { cursor++; continue; }
      const [, ws, key, rest] = km; const ki = ws.length; cursor++;
      if (rest.trim() === '|' || rest.trim() === '>') { map[key] = blockScalar(rest.trim() === '>', ki); continue; }
      if (rest.trim().startsWith('['))                 { map[key] = inlineSeq(rest.trim()); continue; }
      if (rest.trim() === '') {
        let peek = cursor;
        while (peek < lines.length && isBlank(lines[peek])) peek++;
        if (peek < lines.length && indentOf(lines[peek]) > ki) {
          map[key] = /^\s*-\s/.test(lines[peek]) ? sequence(ki) : mapping(ki);
          continue;
        }
        map[key] = ''; continue;
      }
      map[key] = unquote(stripCmt(rest.trim()));
    }
    return map;
  }
  function sequence(baseIndent: number): YamlValue[] {
    const items: YamlValue[] = [];
    while (cursor < lines.length) {
      const line = lines[cursor];
      if (isBlank(line)) { cursor++; continue; }
      if (indentOf(line) <= baseIndent) break;
      const im = line.match(/^(\s*)-\s*(.*)/);
      if (!im) break;
      const [, ws, rest] = im; const ii = ws.length; cursor++;
      const ikm = rest.trim().match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)/);
      if (ikm) {
        const nested: YamlMap = {};
        const [, fk, fv] = ikm;
        if (fv.trim() === '|' || fv.trim() === '>')  nested[fk] = blockScalar(fv.trim() === '>', ii);
        else if (fv.trim().startsWith('['))            nested[fk] = inlineSeq(fv.trim());
        else if (fv.trim() !== '')                     nested[fk] = unquote(stripCmt(fv.trim()));
        Object.assign(nested, mapping(ii));
        items.push(nested); continue;
      }
      if (rest.trim().startsWith('[')) { items.push(inlineSeq(rest.trim())); continue; }
      items.push(unquote(stripCmt(rest.trim())));
    }
    return items;
  }
  return mapping(-1);
}