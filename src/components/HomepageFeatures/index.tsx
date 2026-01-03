import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  // Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Powered by a love for retro',
    // Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        As children of the 90s, we all love and fondly remember
        the era of 16-bit and MS DOS, and we seek to replicate
        this both on retro gaming hardware and modern systems.
      </>
    ),
  },
  {
    title: 'Focused on whimsical multiplatform games',
    // Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        Whether a phone, modern desktop computer or any number
        of retro consoles or home computers is your weapon of choice, 
        we believe everybody deserves to enjoy
        games on their favorite platform.
        <br/><br/>
        For this purpose we vow to do our best to create cozy,
        memorable gaming experiences for anything from Atari 2600,
        over N64 and Dreamcast, all the way to modern consoles and
        PCs.
      </>
    ),
  },
  {
    title: 'Utilizing custom technology',
    // Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        Being focused on resource efficient and well optimized experiences,
        you won't find the likes of Unreal Engine 5 here.

        Most of Happy Ferret's upcoming titles will use one of three
        in-house engines that vary in features, graphical fidelity
        and platform support.
      </>
    ),
  },
];

function Feature({title, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        {/* <Svg className={styles.featureSvg} role="img" /> */}
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
