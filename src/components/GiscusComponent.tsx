import React from "react";
import Giscus from "@giscus/react";
import { useColorMode } from "@docusaurus/theme-common";

export default function GiscusComponent() {
  const { colorMode } = useColorMode();

  return (
    <Giscus
      repo="chenyuan-new/blogByDocusaurus"
      repoId="R_kgDOIl9CDQ"
      category="Announcements"
      categoryId="DIC_kwDOIl9CDc4CdbwV" // E.g. id of "General"
      mapping="og:title" // Important! To map comments to URL
      term="Welcome to @giscus/react component!"
      strict="0"
      reactionsEnabled="1"
      emitMetadata="0"
      inputPosition="bottom"
      theme={colorMode}
      lang="en"
      loading="lazy"
      // crossorigin="anonymous"
      // async
    />
  );
}
