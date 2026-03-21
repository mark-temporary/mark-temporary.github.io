import type { ReactNode } from 'react';
import React, { useEffect, useState } from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShowcaseItem {
  title: string;
  description: string;
  img: string;
  URL?: string;
  tags?: string[];
  release_date?: string;
  birth?: string;
  death?: string;
}

export interface ShowcaseProps {
  /**
   * Path to the YAML file relative to `src/pages/`, e.g. `"games/games.yaml"`.
   * A leading slash is accepted and stripped automatically.
   *
   * The file may contain either:
   *   - A top-level `items` array for multiple entries
   *   - Flat top-level keys for a single entry (backwards-compatible)
   */
  config: string;
}

// ---------------------------------------------------------------------------
// YAML parser
// ---------------------------------------------------------------------------

/*
 * A recursive-descent parser for the subset of YAML used by Showcase files.
 *
 * Supported:
 *   Scalars   – unquoted, single-quoted, double-quoted
 *   Sequences – inline  [a, b, c]
 *               block   - item\n- item
 *   Mappings  – block   key: value  (top-level and nested inside sequences)
 *   Block scalars  |  (literal)  and  >  (folded)
 *   Comments  – # …  (full-line and trailing)
 *
 * The parser operates on a shared mutable cursor so recursive helpers
 * naturally consume lines and return when they reach content at or below
 * the caller's indent level.
 */

type YamlValue = string | YamlValue[] | YamlMap;
type YamlMap   = Record<string, YamlValue>;

function parseShowcaseYaml(raw: string): YamlMap {
  const lines  = raw.replace(/\r\n/g, '\n').split('\n');
  let   cursor = 0;

  const indentOf  = (line: string) => line.match(/^(\s*)/)?.[1].length ?? 0;
  const isBlank   = (line: string) => /^\s*(#.*)?$/.test(line);
  const stripCmt  = (s: string)    => s.replace(/(\s|^)#.*$/, '').trim();
  const unquote   = (s: string): string => {
    const t = s.trim();
    return ((t.startsWith('"') && t.endsWith('"')) ||
            (t.startsWith("'") && t.endsWith("'")))
      ? t.slice(1, -1) : t;
  };

  const parseInlineSeq = (s: string): string[] => {
    const inner = s.slice(s.indexOf('[') + 1, s.lastIndexOf(']'));
    return inner ? inner.split(',').map(x => unquote(stripCmt(x))).filter(Boolean) : [];
  };

  const parseBlockScalar = (fold: boolean, ownerIndent: number): string => {
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

  function parseMapping(baseIndent: number): YamlMap {
    const map: YamlMap = {};

    while (cursor < lines.length) {
      const line = lines[cursor];
      if (isBlank(line)) { cursor++; continue; }
      if (indentOf(line) <= baseIndent) break;

      const km = line.match(/^(\s*)([A-Za-z_][A-Za-z0-9_]*):\s*(.*)/);
      if (!km) { cursor++; continue; }

      const keyIndent = km[1].length;
      const key       = km[2];
      const rest      = km[3].trim();
      cursor++;

      if (rest === '|' || rest === '>') {
        map[key] = parseBlockScalar(rest === '>', keyIndent);
        continue;
      }
      if (rest.startsWith('[')) {
        map[key] = parseInlineSeq(rest);
        continue;
      }
      if (rest === '') {
        // Peek past blanks to decide what follows
        let peek = cursor;
        while (peek < lines.length && isBlank(lines[peek])) peek++;
        if (peek < lines.length && indentOf(lines[peek]) > keyIndent) {
          map[key] = /^\s*-\s/.test(lines[peek])
            ? parseBlockSeq(keyIndent)
            : parseMapping(keyIndent);
          continue;
        }
        map[key] = '';
        continue;
      }
      map[key] = unquote(stripCmt(rest));
    }

    return map;
  }

  function parseBlockSeq(baseIndent: number): YamlValue[] {
    const items: YamlValue[] = [];

    while (cursor < lines.length) {
      const line = lines[cursor];
      if (isBlank(line)) { cursor++; continue; }
      if (indentOf(line) <= baseIndent) break;

      const im = line.match(/^(\s*)-\s+(.*)/);
      if (!im) break;

      const itemIndent = im[1].length;
      const itemRest   = im[2].trim();
      cursor++;

      if (itemRest.startsWith('[')) {
        items.push(parseInlineSeq(itemRest));
        continue;
      }

      // First key of a nested mapping on the same line as `-`
      const ikm = itemRest.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)/);
      if (ikm) {
        const firstKey = ikm[1];
        const firstVal = ikm[2].trim();
        const nested: YamlMap = {};

        if (firstVal === '|' || firstVal === '>') {
          nested[firstKey] = parseBlockScalar(firstVal === '>', itemIndent);
        } else if (firstVal.startsWith('[')) {
          nested[firstKey] = parseInlineSeq(firstVal);
        } else if (firstVal !== '') {
          nested[firstKey] = unquote(stripCmt(firstVal));
        }
        // Remaining keys at deeper indent
        Object.assign(nested, parseMapping(itemIndent));
        items.push(nested);
        continue;
      }

      items.push(unquote(stripCmt(itemRest)));
    }

    return items;
  }

  return parseMapping(-1);
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const REQUIRED: Array<keyof ShowcaseItem> = ['title', 'description', 'img'];

function validateItem(raw: YamlMap, index?: number): ShowcaseItem {
  const label   = index !== undefined ? ` (items[${index}])` : '';
  const missing = REQUIRED.filter(f => !raw[f]);
  if (missing.length > 0) {
    throw new Error(
      `Showcase YAML${label} is missing required field${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.`
    );
  }
  return {
    title:        String(raw.title),
    description:  String(raw.description),
    img:          String(raw.img),
    URL:          raw.URL !== undefined ? String(raw.URL) : undefined,
    tags:         Array.isArray(raw.tags) ? (raw.tags as string[]) : undefined,
    release_date: raw.release_date !== undefined ? String(raw.release_date) : undefined,
    birth: raw.birth !== undefined ? String(raw.birth) : undefined,
    death: raw.death !== undefined ? String(raw.death) : undefined,
  };
}

/**
 * Accepts either:
 *   - A document with a top-level `items` array  → multi-entry
 *   - A flat document with top-level scalar keys  → single-entry (backwards compat)
 */
function extractItems(doc: YamlMap): ShowcaseItem[] {
  if (Array.isArray(doc.items)) {
    return (doc.items as YamlMap[]).map((entry, i) => validateItem(entry, i));
  }
  return [validateItem(doc)];
}

function toIso(raw: string): string {
  // Bare YAML dates (2024-10-15) are treated as UTC midnight to avoid
  // timezone-shift off-by-one-day errors.
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00Z` : raw;
}

function formatDate(raw: string): string {
  try {
    return new Date(toIso(raw)).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
    });
  } catch {
    return raw;
  }
}

function isFutureDate(raw: string): boolean {
  try {
    return new Date(toIso(raw)) > new Date();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TagList({ tags }: { tags: string[] }): ReactNode {
  if (tags.length === 0) return null;
  return (
    <ul className={styles.tagList} aria-label="Tags">
      {tags.map((tag) => (
        <li key={tag} className={styles.tagItem}>
          <span className={styles.tag}>{tag}</span>
        </li>
      ))}
    </ul>
  );
}

function ShowcaseCard({ item }: { item: ShowcaseItem }): ReactNode {
  const { title, description, img, URL: href, tags, release_date, birth, death } = item;
  return (
    <article className={styles.card}>

      {/* Image link — decorative duplicate of the title link, hidden from AT */}
      <Link href={href} className={styles.imgWrapper} aria-hidden tabIndex={-1}>
        <img src={img} alt="" className={styles.img} />
      </Link>

      <div className={styles.body}>

        <Link href={href} className={styles.titleLink}>
          <h2 className={styles.title}>{title}</h2>
        </Link>

        {release_date && (
          <p className={styles.releaseDate}>
            {isFutureDate(String(release_date)) || release_date == "TBA" ? 'Releasing' : 'Released'}:{' '}
            {release_date == "TBA" &&
                <b>TBA</b>
            }
            {release_date != "TBA" &&
            <b><time dateTime={String(release_date)}>
              {formatDate(String(release_date))}
            </time></b>
            }
          </p>
        )}

        {birth && (
            <div>☀️
            <b><time dateTime={String(birth)}>
                {formatDate(String(birth))}
            </time></b>
            </div>
        )}

        {death && (
            <div>🌑
            <b><time dateTime={String(death)}>
                {formatDate(String(death))}
            </time></b>
            </div>
        )}

        <p className={styles.description}>{description}</p>

        {tags && tags.length > 0 && <TagList tags={tags} />}

      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Showcase({ config }: ShowcaseProps): ReactNode {
  const [items, setItems] = useState<ShowcaseItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const yamlPath = useBaseUrl(config.replace(/^\//, ''));

  useEffect(() => {
    let cancelled = false;

    fetch(yamlPath)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status} — could not load "${config}".`);
        return res.text();
      })
      .then(text => {
        if (cancelled) return;
        setItems(extractItems(parseShowcaseYaml(text)));
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });

    return () => { cancelled = true; };
  }, [yamlPath]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (!items && !error) {
    return (
      <div className={styles.loading} role="status" aria-live="polite">
        Loading…
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className={styles.errorCard} role="alert">
        <p><strong>Showcase error:</strong> {error}</p>
        <p className={styles.errorPath}>YAML path: <code>{config}</code></p>
      </div>
    );
  }

  // ── Single card (backwards-compatible, no wrapping element) ─────────────
  if (items!.length === 1) {
    return <ShowcaseCard item={items![0]} />;
  }

  // ── Grid of cards ────────────────────────────────────────────────────────
  return (
    <section className={styles.grid} aria-label="Showcase">
      {items!.map((item, i) => (
        <ShowcaseCard key={`${item.URL}-${i}`} item={item} />
      ))}
    </section>
  );
}