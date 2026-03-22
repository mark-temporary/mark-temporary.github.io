import type { ReactNode } from 'react';
import React, { useEffect, useRef } from 'react';
import clsx from 'clsx';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import IframeCarousel from '@site/src/components/IframeCarousel';
import ParallaxBackground from '@site/src/components/ParallaxBackground';

import styles from './index.module.css';

// Carousel sources — add or reorder as needed
const CAROUSEL_SRCS = [
  'https://happy-ferret.com/SCUMM-Test/',
  'https://happy-ferret.com/SCUMM-Test/',   // placeholder: swap for real game URLs
  'https://happy-ferret.com/SCUMM-Test/',
];

function HomepageHeader(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      headerRef.current?.classList.add('hf-hero-enter');
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <header
      ref={headerRef}
      className={clsx('hero hero--primary', styles.heroBanner)}
    >
      {/* Parallax pixel-art cityscape — rendered behind all content */}
      <ParallaxBackground />

      <div className="container">
        <Heading as="h1" className={clsx('hero__title', 'hf-neon-title')}>
          {siteConfig.title}
        </Heading>
        <p className={clsx('hero__subtitle', 'hf-neon-tagline')}>
          {siteConfig.tagline}
        </p>

        <div className={clsx('hf-hero-body', styles.iframeBody)}>
          {/*
            responsiveSizes replicates the original breakpoints exactly:
              ≥1200px → 960×720 (4:3)
               700–1199px → 640×480
              <700px → 320×240
            The fullscreen button is built into IframeCarousel and always
            targets whichever iframe is currently active.
          */}
          <IframeCarousel
            srcs={CAROUSEL_SRCS}
            responsiveSizes={[
              { minWidth: 1200, width: 960, height: 720 },
              { minWidth: 700,  width: 640, height: 480 },
              { minWidth: 0,    width: 320, height: 240 },
            ]}
            ageVerification={[undefined, 18, undefined]}
          />
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={`Hello from ${siteConfig.title}`}
      description="Welcome to Happy Ferret Entertainment"
    >
      <HomepageHeader />
      <main className="hf-main-enter">
        <HomepageFeatures />
      </main>
    </Layout>
  );
}