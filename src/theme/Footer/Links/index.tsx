import React, {type ReactNode, useState, useEffect} from 'react';
import Links from '@theme-original/Footer/Links';
import type LinksType from '@theme/Footer/Links';
import type {WrapperProps} from '@docusaurus/types';

type Props = WrapperProps<typeof LinksType>;

function SwissOnly({ children }: { children: ReactNode }): ReactNode {
  const [isSwiss, setIsSwiss] = useState<boolean | null>(() => {
    // Read cached result synchronously — no flicker on reload
    try {
      const cached = sessionStorage.getItem('hf-is-swiss');
      if (cached !== null) return cached === 'true';
    } catch {}
    return null;
  });

  useEffect(() => {
    // Already know the answer from cache — skip the fetch
    if (isSwiss !== null) return;

    fetch('https://api.ipwho.org/me?apiKey=sk.f4642191c5542aa4a1e316b7ae1667c92033303881d7db438874ffef33ce0812&get=flag')
      .then(res => res.json())
      .then(data => {
        const result = data.data.flag.flag_unicode === 'U+1F1E8 U+1F1ED';
        try { sessionStorage.setItem('hf-is-swiss', String(result)); } catch {}
        setIsSwiss(result);
      })
      .catch(() => {
        setIsSwiss(false);
      });
  }, []);

  if (isSwiss === null) return null;
  return isSwiss ? <>{children}</> : null;
}

export default function LinksWrapper(props: Props): ReactNode {
  return (
    <>
      <Links {...props} />
      <SwissOnly>
        <div style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.85rem' }}>
          <a href="/imprint">Imprint</a>
        </div>
      </SwissOnly>
    </>
  );
}
