import React from "react";
import clsx from "clsx";
import styles from "./styles.module.css";
import { translate } from "@docusaurus/Translate";
type FeatureItem = {
  title: string;
  // Svg: React.ComponentType<React.ComponentProps<"svg">>;
  description: JSX.Element;
};

const FeatureList: FeatureItem[] = [
  {
    title: translate({message:"支持我"}),
    // Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
       { translate({message:"请给我一个⭐️"})}{" "}
        <a
          target="_blank"
          rel="noopener noreferrer"
          href="https://github.com/chenyuan-new/blogByDocusaurus"
        >
          GitHub
        </a>
      </>
    ),
  },
  {
    title: translate({message:"关于我"}),
    // Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: <>An always to learn FE</>,
  },
  {
    title: translate({message:"联系我"}),
    // Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: <>{translate({message:"微信"})}: emNjOTExMTEw</>,
  },
];

function Feature({ title, description }) {
  return (
    <div className={clsx("col col--4")}>
      <div className="text--center">
        {/* <Svg className={styles.featureSvg} role="img" /> */}
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
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
